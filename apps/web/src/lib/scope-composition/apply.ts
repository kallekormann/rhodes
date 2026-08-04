import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingTier } from "@rhodes/shared/tiers";
import type { MetadataFieldSeed } from "@rhodes/shared/scope-bundles";
import { getViewPresetsByIds } from "@rhodes/shared/scope-bundles";
import { ADDITIONAL_SCOPE_VIEW_CATALOG } from "@rhodes/shared/scope-views";
import {
  resolveScopeComposition,
  type ScopeCompositionInput,
  type ScopeCompositionResult,
  type ScopeSetupConfig,
} from "@rhodes/shared/scope-composition";

export const scopeCompositionBodySchema = z.object({
  selected_base_view_ids: z.array(z.string().min(1)).default([]),
  selected_view_preset_ids: z.array(z.string().min(1)).default([]),
  selected_template_slugs: z.array(z.string().min(1)).default([]),
  selected_bundle_ids: z.array(z.string().min(1)).default([]),
});

export type ScopeCompositionBody = z.infer<typeof scopeCompositionBodySchema>;

export function toCompositionInput(
  body: ScopeCompositionBody,
  tier: BillingTier,
): ScopeCompositionInput {
  return {
    selectedBaseViewIds: body.selected_base_view_ids,
    selectedViewPresetIds: body.selected_view_preset_ids,
    selectedTemplateSlugs: body.selected_template_slugs,
    selectedBundleIds: body.selected_bundle_ids,
    tier,
  };
}

function metadataFieldsToJson(fields: MetadataFieldSeed[]): unknown[] {
  return fields.map((field) => ({
    field_key: field.field_key,
    field_label: field.field_label,
    field_type: field.field_type,
    ...(field.options != null ? { options: field.options } : {}),
    ...(typeof field.ai_fill_enabled === "boolean"
      ? { ai_fill_enabled: field.ai_fill_enabled }
      : {}),
  }));
}

export type ApplyScopeCompositionParams = {
  workspaceId: string;
  composition: ScopeCompositionResult;
  wizardMode?: string;
};

const SEEDABLE_BASE_VIEW_TYPES = new Set(
  ADDITIONAL_SCOPE_VIEW_CATALOG.filter(
    (view) => view.status === "available",
  ).map((view) => view.id),
);

async function seedScopeViewInstances(
  supabase: SupabaseClient,
  workspaceId: string,
  viewPresetIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  if (viewPresetIds.length === 0) return { ok: true };

  const presets = getViewPresetsByIds(viewPresetIds);
  if (presets.length === 0) return { ok: true };

  for (let index = 0; index < presets.length; index += 1) {
    const preset = presets[index]!;
    const payload = {
      workspace_id: workspaceId,
      base_view_type: preset.baseViewType,
      label: preset.label,
      config: preset.config ?? {},
      layout: null as null,
      created_from_preset_id: preset.id,
      position: index,
      updated_at: new Date().toISOString(),
    };

    const { data: existing, error: lookupError } = await supabase
      .from("scope_view_instances")
      .select("id")
      .eq("workspace_id", workspaceId)
      .eq("created_from_preset_id", preset.id)
      .maybeSingle();

    if (lookupError) {
      return { ok: false, message: lookupError.message };
    }

    if (existing?.id) {
      const { error: updateError } = await supabase
        .from("scope_view_instances")
        .update({
          base_view_type: payload.base_view_type,
          label: payload.label,
          config: payload.config,
          position: payload.position,
          updated_at: payload.updated_at,
        })
        .eq("id", existing.id);

      if (updateError) {
        return { ok: false, message: updateError.message };
      }
      continue;
    }

    const { error: insertError } = await supabase
      .from("scope_view_instances")
      .insert(payload);

    if (insertError) {
      return { ok: false, message: insertError.message };
    }
  }

  return { ok: true };
}

/**
 * When a page type is enabled without any preset tabs, seed one default instance
 * so the in-page tab bar is never blank.
 */
async function seedDefaultInstancesForEnabledViews(
  supabase: SupabaseClient,
  workspaceId: string,
  enabledViews: string[],
  viewPresetIds: string[],
): Promise<{ ok: true } | { ok: false; message: string }> {
  const presets = getViewPresetsByIds(viewPresetIds);
  const typesCoveredByPresets = new Set(
    presets.map((preset) => preset.baseViewType),
  );

  for (const viewId of enabledViews) {
    if (!SEEDABLE_BASE_VIEW_TYPES.has(viewId)) continue;
    if (typesCoveredByPresets.has(viewId)) continue;

    const { count, error: countError } = await supabase
      .from("scope_view_instances")
      .select("id", { count: "exact", head: true })
      .eq("workspace_id", workspaceId)
      .eq("base_view_type", viewId);

    if (countError) {
      return { ok: false, message: countError.message };
    }
    if ((count ?? 0) > 0) continue;

    const label =
      ADDITIONAL_SCOPE_VIEW_CATALOG.find((view) => view.id === viewId)?.label ??
      viewId;

    const { error: insertError } = await supabase
      .from("scope_view_instances")
      .insert({
        workspace_id: workspaceId,
        base_view_type: viewId,
        label,
        config: {},
        layout: null,
        created_from_preset_id: null,
        position: 0,
        updated_at: new Date().toISOString(),
      });

    if (insertError) {
      return { ok: false, message: insertError.message };
    }
  }

  return { ok: true };
}

export async function applyScopeComposition(
  supabase: SupabaseClient,
  params: ApplyScopeCompositionParams,
): Promise<{ ok: true } | { ok: false; message: string }> {
  const setupConfig: ScopeSetupConfig = {
    ...params.composition.setupConfig,
    appliedAt: new Date().toISOString(),
    ...(params.wizardMode ? { wizardMode: params.wizardMode } : {}),
  };

  const { error: updateError } = await supabase
    .from("workspaces")
    .update({
      enabled_views: params.composition.enabledViews,
      bundle_ids: params.composition.bundleIds,
      setup_config: setupConfig,
    })
    .eq("id", params.workspaceId);

  if (updateError) {
    return { ok: false, message: updateError.message };
  }

  if (params.composition.metadataFields.length > 0) {
    const { error: seedError } = await supabase.rpc("seed_scope_metadata_fields", {
      ws_id: params.workspaceId,
      fields: metadataFieldsToJson(params.composition.metadataFields),
    });

    if (seedError) {
      return { ok: false, message: seedError.message };
    }
  }

  const instanceSeed = await seedScopeViewInstances(
    supabase,
    params.workspaceId,
    params.composition.viewPresetIds,
  );
  if (!instanceSeed.ok) {
    return instanceSeed;
  }

  const defaultSeed = await seedDefaultInstancesForEnabledViews(
    supabase,
    params.workspaceId,
    params.composition.enabledViews,
    params.composition.viewPresetIds,
  );
  if (!defaultSeed.ok) {
    return defaultSeed;
  }

  return { ok: true };
}

export function resolveAndValidateComposition(
  body: ScopeCompositionBody,
  tier: BillingTier,
) {
  return resolveScopeComposition(toCompositionInput(body, tier));
}

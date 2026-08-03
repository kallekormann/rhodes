import { z } from "zod";
import type { SupabaseClient } from "@supabase/supabase-js";
import type { BillingTier } from "@rhodes/shared/tiers";
import type { MetadataFieldSeed } from "@rhodes/shared/scope-bundles";
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

  return { ok: true };
}

export function resolveAndValidateComposition(
  body: ScopeCompositionBody,
  tier: BillingTier,
) {
  return resolveScopeComposition(toCompositionInput(body, tier));
}

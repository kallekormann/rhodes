import type { AssignableTeamRole } from "@rhodes/shared/team-roles";
import {
  ASSIGNABLE_TEAM_ROLES,
  TEAM_ROLE_LABELS,
  assignableRolesForActor,
  canChangeMemberRole,
  canRemoveTeamMember,
} from "@rhodes/shared/team-roles";
import type { WorkspaceMember, WorkspacePendingInvite } from "@/lib/workspaces/members";
import { Button } from "@/components/Button";
import { Dropdown } from "@/components/Dropdown";
import { StatusPill } from "@/components/StatusPill";
import "./TeamMembersTable.css";

type TeamMembersTableProps = {
  members: WorkspaceMember[];
  pendingInvites: WorkspacePendingInvite[];
  currentUserId: string;
  canInvite: boolean;
  canChangeRoles: boolean;
  canRemoveMembers: boolean;
  removingMemberId: string | null;
  cancelingInviteId: string | null;
  updatingMemberId: string | null;
  onRemoveMember: (userId: string) => void;
  onCancelInvite: (inviteId: string) => void;
  onChangeRole: (userId: string, role: AssignableTeamRole) => void;
};

const roleOptions = ASSIGNABLE_TEAM_ROLES.map((role) => ({
  id: role,
  label: TEAM_ROLE_LABELS[role],
}));

export function TeamMembersTable({
  members,
  pendingInvites,
  currentUserId,
  canInvite,
  canChangeRoles,
  canRemoveMembers,
  removingMemberId,
  cancelingInviteId,
  updatingMemberId,
  onRemoveMember,
  onCancelInvite,
  onChangeRole,
}: TeamMembersTableProps) {
  const callerRole = members.find((member) => member.user_id === currentUserId)?.role;
  const editableRoles = assignableRolesForActor(callerRole);
  const showActionsColumn = canInvite || canChangeRoles || canRemoveMembers;

  return (
    <div className="team-members-table-wrap">
      <table className="team-members-table">
        <thead>
          <tr>
            <th scope="col">Member</th>
            <th scope="col">Role</th>
            <th scope="col">Status</th>
            {showActionsColumn ? (
              <th scope="col" className="team-members-table__actions-col" />
            ) : null}
          </tr>
        </thead>
        <tbody>
          {members.map((member) => {
            const showRemove =
              canRemoveMembers &&
              canRemoveTeamMember(
                callerRole,
                member.role,
                currentUserId,
                member.user_id,
              );
            const showRoleEditor =
              canChangeRoles &&
              member.role !== "owner" &&
              member.user_id !== currentUserId &&
              editableRoles.length > 0;

            return (
              <tr key={member.user_id}>
                <td className="team-members-table__name">{member.display_name}</td>
                <td>
                  {showRoleEditor && updatingMemberId !== member.user_id ? (
                    <Dropdown
                      variant="field"
                      value={
                        member.role === "admin" ||
                        member.role === "member" ||
                        member.role === "viewer"
                          ? member.role
                          : "member"
                      }
                      options={roleOptions.filter((option) =>
                        editableRoles.includes(option.id as AssignableTeamRole),
                      )}
                      onChange={(value) =>
                        onChangeRole(member.user_id, value as AssignableTeamRole)
                      }
                    />
                  ) : (
                    TEAM_ROLE_LABELS[member.role]
                  )}
                </td>
                <td>
                  <StatusPill variant="success" label="Active" />
                </td>
                {showActionsColumn ? (
                  <td className="team-members-table__actions">
                    {showRemove ? (
                      <Button
                        variant="ghost"
                        size="small"
                        loading={removingMemberId === member.user_id}
                        onClick={() => onRemoveMember(member.user_id)}
                      >
                        Remove
                      </Button>
                    ) : null}
                  </td>
                ) : null}
              </tr>
            );
          })}
          {pendingInvites.map((invite) => (
            <tr key={invite.id}>
              <td className="team-members-table__name">{invite.email}</td>
              <td>{TEAM_ROLE_LABELS[invite.role]}</td>
              <td>
                <StatusPill variant="warning" label="Pending" />
              </td>
              {canInvite ? (
                <td className="team-members-table__actions">
                  <Button
                    variant="ghost"
                    size="small"
                    loading={cancelingInviteId === invite.id}
                    onClick={() => onCancelInvite(invite.id)}
                  >
                    Cancel invite
                  </Button>
                </td>
              ) : showActionsColumn ? (
                <td />
              ) : null}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

export { canChangeMemberRole };

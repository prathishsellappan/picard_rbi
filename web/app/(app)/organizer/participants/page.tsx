import { ActionForm } from "@/components/ActionForm";
import { buttonClass, Card, inputClass, linkClass, PageTitle } from "@/components/ui";
import { requireOrganizer } from "@/lib/auth";
import { getServerConfig } from "@/lib/config";
import {
  getScenarioForOrganizer,
  listParticipantsForOrganizer,
  type OrganizerParticipantRow,
} from "@/lib/data/organizer";
import { PARTICIPANT_ROLES } from "@/lib/roles";
import { createParticipantAction, resetPasswordAction, updateParticipantAction } from "../actions";

function ParticipantFields({ p }: { p?: OrganizerParticipantRow }) {
  return (
    <div className="grid gap-2 md:grid-cols-2">
      <label className="text-[11.5px]">
        ID
        <input
          name="id"
          defaultValue={p?.id}
          readOnly={!!p}
          className={`${inputClass} ${p ? "bg-paper-deep" : ""}`}
          placeholder="P16"
        />
      </label>
      <label className="text-[11.5px]">
        Login username
        <input
          name="username"
          defaultValue={p?.username}
          className={`${inputClass} font-mono`}
          placeholder="investor10"
          required
        />
      </label>
      <label className="text-[11.5px]">
        Display name
        <input name="displayName" defaultValue={p?.display_name} className={inputClass} required />
      </label>
      <label className="text-[11.5px]">
        Explorer label (public; leave empty to show the address only)
        <input
          name="explorerLabel"
          defaultValue={p?.explorer_label}
          className={inputClass}
          placeholder="e.g. Buyer 1"
        />
      </label>
      <label className="text-[11.5px]">
        Role
        <select name="role" defaultValue={p?.role ?? "investor"} className={inputClass}>
          {PARTICIPANT_ROLES.map((r) => (
            <option key={r} value={r}>
              {r}
            </option>
          ))}
        </select>
      </label>
      <label className="text-[11.5px]">
        Assigned wallet
        <input name="walletAddress" defaultValue={p?.wallet_address} className={`${inputClass} font-mono`} required />
      </label>
      <label className="text-[11.5px] md:col-span-2">
        Instructions (shown only to this participant)
        <textarea name="instructions" defaultValue={p?.instructions} rows={2} className={inputClass} />
      </label>
      <label className="text-[11.5px] md:col-span-2">
        Organizer notes (never shown to participants)
        <textarea name="organizerNotes" defaultValue={p?.organizer_notes} rows={1} className={inputClass} />
      </label>
      <label className="flex items-center gap-2 text-[11.5px]">
        <input type="checkbox" name="isMalicious" defaultChecked={p?.is_malicious} />
        Malicious creator (organizer only)
      </label>
    </div>
  );
}

export default async function OrganizerParticipantsPage() {
  await requireOrganizer();
  const scenario = await getScenarioForOrganizer(getServerConfig().chain.id);
  if (!scenario) return <PageTitle title="Participants" subtitle="No active scenario. Run the seed script." />;
  const participants = await listParticipantsForOrganizer(scenario.id);

  return (
    <>
      <PageTitle
        title="Participants"
        subtitle="Roles, assigned wallets, and private instructions. Only public addresses are stored — never keys."
      />
      <div className="space-y-4">
        {participants.map((p) => (
          <Card
            key={p.id}
            title={`${p.id} · login ${p.username} · ${p.role}${p.is_malicious ? " · malicious" : ""}`}
            actions={
              <ActionForm action={resetPasswordAction} className="text-right">
                <input type="hidden" name="id" value={p.id} />
                <button type="submit" className={`text-[11.5px] ${linkClass}`}>
                  Reset password
                </button>
              </ActionForm>
            }
          >
            <ActionForm action={updateParticipantAction} className="space-y-2">
              <ParticipantFields p={p} />
              <button type="submit" className={buttonClass}>
                Save
              </button>
            </ActionForm>
          </Card>
        ))}

        <Card title="Add participant">
          <ActionForm action={createParticipantAction} className="space-y-2">
            <ParticipantFields />
            <button type="submit" className={buttonClass}>
              Create participant
            </button>
          </ActionForm>
        </Card>
      </div>
    </>
  );
}

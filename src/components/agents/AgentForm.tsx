import { useState } from "react";
import { Loader2, Save } from "lucide-react";
import { toast } from "sonner";

import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { FileDropzone } from "@/components/billzo/FileDropzone";
import { SecureImage } from "@/components/billzo/SecureImage";
import { useAuth } from "@/hooks/useAuth";
import { uploadAndRegister } from "@/lib/storage";
import {
  AGENT_STATUSES,
  BLOOD_GROUPS,
  EMPLOYEE_TYPES,
  GENDERS,
  MARITAL_STATUSES,
  PROVINCES,
  SHIFT_TIMINGS,
  labelize,
} from "@/lib/billzo";
import {
  useDepartments,
  useDesignations,
  useStaffProfiles,
  type AgentWithRefs,
} from "@/lib/queries";

export type AgentFormValues = Record<string, unknown>;

type AgentFormState = {
  full_name: string;
  father_name: string;
  cnic_number: string;
  passport_number: string;
  date_of_birth: string;
  gender: string;
  blood_group: string;
  marital_status: string;
  profile_picture_url: string;
  cnic_front_url: string;
  cnic_back_url: string;
  passport_url: string;
  phone_number: string;
  whatsapp_number: string;
  email: string;
  emergency_contact_name: string;
  emergency_contact_number: string;
  home_address: string;
  city: string;
  province: string;
  country: string;
  department_id: string;
  designation_id: string;
  joining_date: string;
  employee_type: string;
  shift_timing: string;
  assigned_admin_id: string;
  status: string;
  highest_qualification: string;
  institute_name: string;
  degree: string;
  certifications: string;
  previous_experience: string;
  previous_company: string;
  skills: string;
  languages: string;
  notes: string;
  bank_name: string;
  account_title: string;
  account_number: string;
  iban: string;
  salary: string | number;
};

type ImageKey = "profile_picture_url" | "cnic_front_url" | "cnic_back_url" | "passport_url";

const NONE = "__none__";

function Field({
  label,
  children,
  full,
}: {
  label: string;
  children: React.ReactNode;
  full?: boolean;
}) {
  return (
    <div className={full ? "space-y-2 sm:col-span-2 lg:col-span-3" : "space-y-2"}>
      <Label className="text-xs uppercase tracking-wide text-muted-foreground">{label}</Label>
      {children}
    </div>
  );
}

const Grid = ({ children }: { children: React.ReactNode }) => (
  <div className="grid gap-4 pt-5 sm:grid-cols-2 lg:grid-cols-3">{children}</div>
);

export function AgentForm({
  agent,
  onSubmit,
  saving,
  readOnlyEmployment,
}: {
  agent?: AgentWithRefs | null;
  onSubmit: (values: AgentFormValues) => Promise<void> | void;
  saving?: boolean;
  readOnlyEmployment?: boolean;
}) {
  const { user } = useAuth();
  const { data: departments } = useDepartments();
  const { data: designations } = useDesignations();
  const { data: staff } = useStaffProfiles();
  const admins = (staff ?? []).filter(
    (s) => s.roles.includes("admin") || s.roles.includes("super_admin"),
  );

  const [values, setValues] = useState<AgentFormState>({
    full_name: agent?.full_name ?? "",
    father_name: agent?.father_name ?? "",
    cnic_number: agent?.cnic_number ?? "",
    passport_number: agent?.passport_number ?? "",
    date_of_birth: agent?.date_of_birth ?? "",
    gender: agent?.gender ?? "",
    blood_group: agent?.blood_group ?? "",
    marital_status: agent?.marital_status ?? "",
    profile_picture_url: agent?.profile_picture_url ?? "",
    cnic_front_url: agent?.cnic_front_url ?? "",
    cnic_back_url: agent?.cnic_back_url ?? "",
    passport_url: agent?.passport_url ?? "",
    phone_number: agent?.phone_number ?? "",
    whatsapp_number: agent?.whatsapp_number ?? "",
    email: agent?.email ?? "",
    emergency_contact_name: agent?.emergency_contact_name ?? "",
    emergency_contact_number: agent?.emergency_contact_number ?? "",
    home_address: agent?.home_address ?? "",
    city: agent?.city ?? "",
    province: agent?.province ?? "",
    country: agent?.country ?? "Pakistan",
    department_id: agent?.department_id ?? "",
    designation_id: agent?.designation_id ?? "",
    joining_date: agent?.joining_date ?? "",
    employee_type: agent?.employee_type ?? "",
    shift_timing: agent?.shift_timing ?? "",
    assigned_admin_id: agent?.assigned_admin_id ?? "",
    salary: agent?.salary ?? "",
    status: agent?.status ?? "active",
    highest_qualification: agent?.highest_qualification ?? "",
    institute_name: agent?.institute_name ?? "",
    degree: agent?.degree ?? "",
    certifications: agent?.certifications ?? "",
    previous_experience: agent?.previous_experience ?? "",
    previous_company: agent?.previous_company ?? "",
    skills: agent?.skills ?? "",
    languages: agent?.languages ?? "",
    notes: agent?.notes ?? "",
    bank_name: agent?.bank_name ?? "",
    account_title: agent?.account_title ?? "",
    account_number: agent?.account_number ?? "",
    iban: agent?.iban ?? "",
  });
  const [uploading, setUploading] = useState<string | null>(null);

  const set = (key: keyof AgentFormState, value: string | number) =>
    setValues((v) => ({ ...v, [key]: value }) as AgentFormState);

  const handleImage = async (key: ImageKey, category: string, file: File) => {
    if (!agent?.id) {
      toast.error("Save the agent first, then upload images.");
      return;
    }
    setUploading(key);
    try {
      const path = await uploadAndRegister({
        agentId: agent.id,
        category,
        file,
        uploadedBy: user?.id ?? null,
      });
      set(key, path);
      toast.success("File uploaded");
    } catch (e) {
      toast.error(e instanceof Error ? e.message : "Upload failed");
    } finally {
      setUploading(null);
    }
  };

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!String(values.full_name ?? "").trim()) {
      toast.error("Full name is required");
      return;
    }
    const payload: Record<string, unknown> = {};

    // Employment-only fields — strip them out when readOnlyEmployment is true
    // (non-staff users must not send salary / department / designation etc.)
    const employmentKeys = new Set([
      "department_id",
      "designation_id",
      "joining_date",
      "employee_type",
      "shift_timing",
      "assigned_admin_id",
      "salary",
      "status",
    ]);

    for (const [k, v] of Object.entries(values)) {
      if (readOnlyEmployment && employmentKeys.has(k)) continue;
      payload[k] = v === "" ? null : v;
    }

    // Salary — only include when staff is editing
    if (!readOnlyEmployment) {
      payload["salary"] =
        values.salary === "" || values.salary == null ? null : Number(values.salary);
    }

    await onSubmit(payload);
  };

  const imageSlot = (key: ImageKey, label: string, category: string) => (
    <Field label={label}>
      <div className="flex items-center gap-3">
        <SecureImage
          path={values[key] || null}
          alt={label}
          className="size-16 shrink-0 rounded-xl object-cover ring-1 ring-border"
        />
        <FileDropzone
          className="flex-1 px-3 py-4"
          busy={uploading === key}
          label="Drop image"
          hint="or click to browse"
          accept="image/*"
          onFiles={(files) => void handleImage(key, category, files[0]!)}
        />
      </div>
    </Field>
  );

  return (
    <form onSubmit={submit} className="space-y-5">
      <Tabs defaultValue="personal">
        <div className="overflow-x-auto pb-1">
          <TabsList className="bg-secondary/60">
            <TabsTrigger value="personal">Personal</TabsTrigger>
            <TabsTrigger value="contact">Contact</TabsTrigger>
            <TabsTrigger value="employment">Employment</TabsTrigger>
            <TabsTrigger value="education">Education</TabsTrigger>
            <TabsTrigger value="work">Work</TabsTrigger>
            <TabsTrigger value="bank">Bank</TabsTrigger>
          </TabsList>
        </div>

        <TabsContent value="personal">
          <Grid>
            <Field label="Full Name">
              <Input
                value={values.full_name}
                onChange={(e) => set("full_name", e.target.value)}
                required
              />
            </Field>
            <Field label="Father Name">
              <Input
                value={values.father_name}
                onChange={(e) => set("father_name", e.target.value)}
              />
            </Field>
            <Field label="CNIC Number">
              <Input
                value={values.cnic_number}
                onChange={(e) => set("cnic_number", e.target.value)}
                placeholder="35202-1234567-8"
              />
            </Field>
            <Field label="Passport Number">
              <Input
                value={values.passport_number}
                onChange={(e) => set("passport_number", e.target.value)}
              />
            </Field>
            <Field label="Date of Birth">
              <Input
                type="date"
                value={values.date_of_birth}
                onChange={(e) => set("date_of_birth", e.target.value)}
              />
            </Field>
            <Field label="Gender">
              <Select
                value={values.gender || NONE}
                onValueChange={(v) => set("gender", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select gender" />
                </SelectTrigger>
                <SelectContent>
                  {GENDERS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Blood Group">
              <Select
                value={values.blood_group || NONE}
                onValueChange={(v) => set("blood_group", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select blood group" />
                </SelectTrigger>
                <SelectContent>
                  {BLOOD_GROUPS.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Marital Status">
              <Select
                value={values.marital_status || NONE}
                onValueChange={(v) => set("marital_status", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select status" />
                </SelectTrigger>
                <SelectContent>
                  {MARITAL_STATUSES.map((g) => (
                    <SelectItem key={g} value={g}>
                      {g}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            {imageSlot("profile_picture_url", "Profile Picture", "profile_picture")}
            {imageSlot("cnic_front_url", "CNIC Front", "cnic_front")}
            {imageSlot("cnic_back_url", "CNIC Back", "cnic_back")}
            {imageSlot("passport_url", "Passport Picture", "passport")}
          </Grid>
        </TabsContent>

        <TabsContent value="contact">
          <Grid>
            <Field label="Phone Number">
              <Input
                value={values.phone_number}
                onChange={(e) => set("phone_number", e.target.value)}
                placeholder="+92 300 1234567"
              />
            </Field>
            <Field label="WhatsApp Number">
              <Input
                value={values.whatsapp_number}
                onChange={(e) => set("whatsapp_number", e.target.value)}
              />
            </Field>
            <Field label="Email Address">
              <Input
                type="email"
                value={values.email}
                onChange={(e) => set("email", e.target.value)}
              />
            </Field>
            <Field label="Emergency Contact Name">
              <Input
                value={values.emergency_contact_name}
                onChange={(e) => set("emergency_contact_name", e.target.value)}
              />
            </Field>
            <Field label="Emergency Contact Number">
              <Input
                value={values.emergency_contact_number}
                onChange={(e) => set("emergency_contact_number", e.target.value)}
              />
            </Field>
            <Field label="City">
              <Input value={values.city} onChange={(e) => set("city", e.target.value)} />
            </Field>
            <Field label="Province">
              <Select
                value={values.province || NONE}
                onValueChange={(v) => set("province", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select province" />
                </SelectTrigger>
                <SelectContent>
                  {PROVINCES.map((p) => (
                    <SelectItem key={p} value={p}>
                      {p}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Country">
              <Input value={values.country} onChange={(e) => set("country", e.target.value)} />
            </Field>
            <Field label="Home Address" full>
              <Textarea
                rows={2}
                value={values.home_address}
                onChange={(e) => set("home_address", e.target.value)}
              />
            </Field>
          </Grid>
        </TabsContent>

        <TabsContent value="employment">
          <Grid>
            <Field label="Department">
              <Select
                disabled={Boolean(readOnlyEmployment)}
                value={values.department_id || NONE}
                onValueChange={(v) => set("department_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select department" />
                </SelectTrigger>
                <SelectContent>
                  {(departments ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Designation">
              <Select
                disabled={Boolean(readOnlyEmployment)}
                value={values.designation_id || NONE}
                onValueChange={(v) => set("designation_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select designation" />
                </SelectTrigger>
                <SelectContent>
                  {(designations ?? []).map((d) => (
                    <SelectItem key={d.id} value={d.id}>
                      {d.name}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Joining Date">
              <Input
                type="date"
                disabled={Boolean(readOnlyEmployment)}
                value={values.joining_date}
                onChange={(e) => set("joining_date", e.target.value)}
              />
            </Field>
            <Field label="Employee Type">
              <Select
                disabled={Boolean(readOnlyEmployment)}
                value={values.employee_type || NONE}
                onValueChange={(v) => set("employee_type", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select type" />
                </SelectTrigger>
                <SelectContent>
                  {EMPLOYEE_TYPES.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Shift Timing">
              <Select
                disabled={Boolean(readOnlyEmployment)}
                value={values.shift_timing || NONE}
                onValueChange={(v) => set("shift_timing", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select shift" />
                </SelectTrigger>
                <SelectContent>
                  {SHIFT_TIMINGS.map((t) => (
                    <SelectItem key={t} value={t}>
                      {t}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Assigned Admin">
              <Select
                disabled={Boolean(readOnlyEmployment)}
                value={values.assigned_admin_id || NONE}
                onValueChange={(v) => set("assigned_admin_id", v === NONE ? "" : v)}
              >
                <SelectTrigger>
                  <SelectValue placeholder="Select admin" />
                </SelectTrigger>
                <SelectContent>
                  {admins.map((a) => (
                    <SelectItem key={a.id} value={a.id}>
                      {a.full_name ?? a.email}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
            <Field label="Salary (PKR ₨)">
              <Input
                type="number"
                min={0}
                disabled={Boolean(readOnlyEmployment)}
                value={values.salary}
                onChange={(e) => set("salary", e.target.value)}
              />
            </Field>
            <Field label="Status">
              <Select
                disabled={Boolean(readOnlyEmployment)}
                value={values.status}
                onValueChange={(v) => set("status", v)}
              >
                <SelectTrigger>
                  <SelectValue />
                </SelectTrigger>
                <SelectContent>
                  {AGENT_STATUSES.map((s) => (
                    <SelectItem key={s} value={s}>
                      {labelize(s)}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </Field>
          </Grid>
        </TabsContent>

        <TabsContent value="education">
          <Grid>
            <Field label="Highest Qualification">
              <Input
                value={values.highest_qualification}
                onChange={(e) => set("highest_qualification", e.target.value)}
              />
            </Field>
            <Field label="Institute Name">
              <Input
                value={values.institute_name}
                onChange={(e) => set("institute_name", e.target.value)}
              />
            </Field>
            <Field label="Degree">
              <Input value={values.degree} onChange={(e) => set("degree", e.target.value)} />
            </Field>
            <Field label="Certifications" full>
              <Textarea
                rows={3}
                value={values.certifications}
                onChange={(e) => set("certifications", e.target.value)}
              />
            </Field>
          </Grid>
        </TabsContent>

        <TabsContent value="work">
          <Grid>
            <Field label="Previous Company">
              <Input
                value={values.previous_company}
                onChange={(e) => set("previous_company", e.target.value)}
              />
            </Field>
            <Field label="Languages">
              <Input
                value={values.languages}
                onChange={(e) => set("languages", e.target.value)}
                placeholder="Urdu, English"
              />
            </Field>
            <Field label="Skills">
              <Input
                value={values.skills}
                onChange={(e) => set("skills", e.target.value)}
                placeholder="Sales, CRM"
              />
            </Field>
            <Field label="Previous Experience" full>
              <Textarea
                rows={3}
                value={values.previous_experience}
                onChange={(e) => set("previous_experience", e.target.value)}
              />
            </Field>
            <Field label="Notes" full>
              <Textarea
                rows={3}
                value={values.notes}
                onChange={(e) => set("notes", e.target.value)}
              />
            </Field>
          </Grid>
        </TabsContent>

        <TabsContent value="bank">
          <Grid>
            <Field label="Bank Name">
              <Input value={values.bank_name} onChange={(e) => set("bank_name", e.target.value)} />
            </Field>
            <Field label="Account Title">
              <Input
                value={values.account_title}
                onChange={(e) => set("account_title", e.target.value)}
              />
            </Field>
            <Field label="Account Number">
              <Input
                value={values.account_number}
                onChange={(e) => set("account_number", e.target.value)}
              />
            </Field>
            <Field label="IBAN">
              <Input
                value={values.iban}
                onChange={(e) => set("iban", e.target.value)}
                placeholder="PK00XXXX0000000000000000"
              />
            </Field>
          </Grid>
        </TabsContent>
      </Tabs>

      <div className="flex justify-end gap-2 border-t border-border pt-4">
        <Button type="submit" disabled={saving}>
          {saving ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
          {agent ? "Save Changes" : "Create Agent"}
        </Button>
      </div>
    </form>
  );
}

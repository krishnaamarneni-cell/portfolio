import { redirect } from "next/navigation";
import { getSession } from "@/lib/auth";
import { fetchJobs, fetchProjects, fetchSiteContent } from "@/lib/content";
import AdminDashboard from "./AdminDashboard";

export const dynamic = "force-dynamic";

export default async function AdminPage() {
  const session = await getSession();
  if (!session) {
    redirect("/admin/login");
  }

  const [jobs, projects, siteContent] = await Promise.all([
    fetchJobs(),
    fetchProjects(),
    fetchSiteContent(),
  ]);

  return (
    <AdminDashboard
      session={session}
      initialJobs={jobs}
      initialProjects={projects}
      initialSiteContent={siteContent}
    />
  );
}

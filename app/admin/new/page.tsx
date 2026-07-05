import Editor from "@/components/Editor";
import SiteFooter from "@/components/SiteFooter";
import SiteHeader from "@/components/SiteHeader";
import { recallAuthor } from "@/lib/author";
import { requireAuth } from "@/lib/auth";
import { listLabels } from "@/lib/repository";

export const dynamic = "force-dynamic";

type Props = {
  searchParams: Promise<{ error?: string }>;
};

export default async function NewPostPage({ searchParams }: Props) {
  await requireAuth();
  const { error } = await searchParams;
  const notice = error === "title" ? "A title is required." : undefined;

  return (
    <div className="shell">
      <SiteHeader />
      <main className="main">
        <div className="page">
          <span className="label muted">New</span>
          <h1 className="headline" style={{ margin: "0.25rem 0 1.5rem" }}>
            Write a post
          </h1>
          <Editor
            notice={notice}
            initialAuthor={await recallAuthor()}
            allLabels={await listLabels()}
          />
        </div>
      </main>
      <SiteFooter />
    </div>
  );
}

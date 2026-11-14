import TenantPublicPage from "./tenant-page";

export default function BlogPage({ params }: { params: { websiteUid: string } }) {
  return <TenantPublicPage params={params} kind="blog" />;
}
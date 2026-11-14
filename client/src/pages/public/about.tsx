import TenantPublicPage from "./tenant-page";

export default function AboutPage({ params }: { params: { websiteUid: string } }) {
  return <TenantPublicPage params={params} kind="about" />;
}
import { useQuery } from "@tanstack/react-query";
import PublicBankingHomePage from "./PublicBankingHome";
import { publicGetPromoVideo } from "../lib/portal-api";
import { WEBSITE_CONFIG } from "../config";

interface Props {
  onCustomerLogin: () => void;
  onStaffLogin: () => void;
}

export default function PublicHome(_props: Props) {
  const config = WEBSITE_CONFIG;
  const { data: promoVideo } = useQuery({
    queryKey: ["public-promo-video", config.websiteUid],
    queryFn: () => publicGetPromoVideo(config.websiteUid),
    enabled: !!config.websiteUid,
    retry: false,
  });
  return <PublicBankingHomePage
    websiteUid={config.websiteUid}
    siteName={config.name}
    primary={config.primaryColor}
    logoUrl={config.logoUrl || null}
    loginHref={"/banking/" + encodeURIComponent(config.websiteUid) + "/login"}
    registerHref={"/banking/" + encodeURIComponent(config.websiteUid) + "/register"}
    promoVideo={(promoVideo as any) ?? null}
    companyInfo={config}
    templateContent={config.homepageContent as any}
  />;
}

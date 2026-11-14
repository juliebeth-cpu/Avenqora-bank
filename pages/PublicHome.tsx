import PublicBankingHomePage from "./PublicBankingHome";
import { WEBSITE_CONFIG } from "../config";

interface Props {
  onCustomerLogin: () => void;
  onStaffLogin: () => void;
}

export default function PublicHome(_props: Props) {
  const config = WEBSITE_CONFIG;
  return <PublicBankingHomePage
    websiteUid={config.websiteUid}
    siteName={config.name}
    primary={config.primaryColor}
    logoUrl={config.logoUrl || null}
    loginHref={"/banking/" + encodeURIComponent(config.websiteUid) + "/login"}
    registerHref={"/banking/" + encodeURIComponent(config.websiteUid) + "/register"}
    promoVideo={config.promoVideo as any}
    companyInfo={config}
    templateContent={config.homepageContent as any}
  />;
}

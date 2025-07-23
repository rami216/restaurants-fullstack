// frontend/src/app/[subdomain]/categories/[categoryId]/page.tsx
import api from "@/lib/axios";
import { PublicWebsiteData } from "@/components/builder/Properties";
import CategoryMenu from "@/components/preview/CategoryMenu";
type Props = {
  params: { subdomain: string; categoryId: string };
};

export default async function CategoryMenuPage({ params }: Props) {
  // 1) fetch the public site data, including locations[]
  const { data: websiteData } = await api.get<PublicWebsiteData>(
    `/builder/public/${params.subdomain}`
  );
  if (!websiteData) {
    return <p className="p-8">Site not found.</p>;
  }

  // 2) render the client‐side component, passing it everything it needs
  return (
    <CategoryMenu websiteData={websiteData} categoryId={params.categoryId} />
  );
}

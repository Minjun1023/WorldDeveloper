import { CountryTiles } from "@/components/home/CountryTiles";
import { fetchRegions } from "@/lib/api";

export const dynamic = "force-dynamic";

export default async function RegionsPage() {
  const regions = await fetchRegions();
  // 원격은 근무형태라 국가 목록에서 제외, 공고 있는 국가만
  const countryRegions = regions.filter((r) => r.value !== "remote" && r.count > 0);

  return (
    <div className="space-y-6">
      <section>
        <h1 className="text-display">국가별로 찾기</h1>
        <p className="mt-2 text-muted-foreground">
          공고가 있는 국가를 모았어요. 국가를 누르면 해당 지역 공고로 이동해요.
        </p>
      </section>

      {countryRegions.length > 0 ? (
        <>
          <p className="text-caption text-muted-foreground">{countryRegions.length}개 국가</p>
          <CountryTiles regions={countryRegions} />
        </>
      ) : (
        <div className="rounded-lg border border-border bg-surface p-6 text-body-sm text-muted-foreground">
          표시할 국가가 없어요.
        </div>
      )}
    </div>
  );
}

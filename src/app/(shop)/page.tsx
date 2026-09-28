import { HeroBanner } from "@/components/home/HeroBanner"
import { PromoCards } from "@/components/home/PromoCards"
import { HomeCollections } from "@/components/home/HomeCollections"
import { CtaBanner } from "@/components/home/CtaBanner"

export default function HomePage() {
  return (
    <>
      <HeroBanner />
      <PromoCards />
      <HomeCollections />
      <CtaBanner />
    </>
  )
}

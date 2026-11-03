import SketchThemeClient from "./SketchThemeClient";
import SeoContentSections from "../SeoContentSections";
import StudioIntro from "./StudioIntro";

export default function SketchThemeLayout() {
  return (
    <main className="ice-studio">
      <SketchThemeClient intro={<StudioIntro />} />
      <SeoContentSections />
    </main>
  );
}

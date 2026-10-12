import SketchThemeClient from "./SketchThemeClient";
import StudioIntro from "./StudioIntro";

export default function SketchThemeLayout() {
  return (
    <main className="ice-studio">
      <SketchThemeClient intro={<StudioIntro />} />
    </main>
  );
}

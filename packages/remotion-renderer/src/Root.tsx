import React from "react";
import { Composition } from "remotion";
import { Test } from "./compositions/Test";
import { ItemSpotlight, itemSpotlightDefaults } from "./compositions/ItemSpotlight";

const FPS = 30;

// Composition ids MUST match the seeded motion_templates.composition_id
// (migration 0068): ItemSpotlight = square_1_1, 8s. `Test` is a toolchain
// smoke-check only (not seeded).
export const RemotionRoot: React.FC = () => {
  return (
    <>
      <Composition
        id="Test"
        component={Test}
        durationInFrames={FPS * 2}
        fps={FPS}
        width={1080}
        height={1080}
      />
      <Composition
        id="ItemSpotlight"
        component={ItemSpotlight}
        durationInFrames={FPS * 8}
        fps={FPS}
        width={1080}
        height={1080}
        defaultProps={itemSpotlightDefaults}
      />
    </>
  );
};

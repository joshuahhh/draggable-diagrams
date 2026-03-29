import { DemoDraggable } from "../demo/ui";
import {
  makeDraggable as makeReorderableList,
  initialState as reorderableState,
} from "../demos/study-reorderable-list";
import {
  draggable as rotaryDraggable,
  initialState as rotaryState,
} from "../demos/study-rotary-dial";
import {
  draggable as sliderDraggable,
  initialState as sliderState,
} from "../demos/study-slider";
import {
  draggable as switchDraggable,
  initialState as switchState,
} from "../demos/study-switch";
import {
  makeDraggable as makeThreeWaySwitch,
  initialState as threeWayState,
} from "../demos/study-three-way-switch";
import {
  draggable as timelineDraggable,
  initialState as timelineState,
} from "../demos/study-timeline";
import { Section } from "./StudioPage";

const threeWayDraggable = makeThreeWaySwitch(false, false);
const reorderableDraggable = makeReorderableList(false, false);

export function StudySection() {
  return (
    <Section title="Study">
      <div className="flex flex-wrap gap-12 items-start">
        <DemoDraggable
          draggable={switchDraggable}
          initialState={switchState}
          width={200}
          height={200}
        />
        <DemoDraggable
          draggable={threeWayDraggable}
          initialState={threeWayState}
          width={200}
          height={200}
        />
        <DemoDraggable
          draggable={reorderableDraggable}
          initialState={reorderableState}
          width={220}
          height={230}
        />
        <DemoDraggable
          draggable={sliderDraggable}
          initialState={sliderState}
          width={180}
          height={130}
        />
        <DemoDraggable
          draggable={rotaryDraggable}
          initialState={rotaryState}
          width={300}
          height={250}
        />
        <DemoDraggable
          draggable={timelineDraggable}
          initialState={timelineState}
          width={200}
          height={200}
        />
      </div>
    </Section>
  );
}

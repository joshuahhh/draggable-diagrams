import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { ManipulableSvg, ManipulableSvgDrawer } from "../manipulable-svg";

interface DemoSvgProps<T extends object> {
  id: string;
  title: string;
  notes?: ReactNode;
  manipulableSvg: ManipulableSvg<T>;
  initialState: T;
  height: number;
  padding?: number;
}

export function DemoSvg<T extends object>({
  id,
  title,
  notes,
  manipulableSvg,
  initialState,
  height,
  padding = 0,
}: DemoSvgProps<T>) {
  return (
    <div className="bg-white rounded-lg p-5 shadow-sm" id={id}>
      <div className="flex items-center justify-between mb-4">
        <h2 className="text-xl font-semibold text-gray-900 m-0">
          <Link
            to={`/${id}`}
            className="no-underline text-gray-900 hover:text-gray-700 transition-colors"
          >
            {title}
          </Link>
        </h2>
      </div>
      {notes && <div className="mt-2 text-sm text-gray-600">{notes}</div>}
      <div className="flex flex-col md:flex-row gap-4">
        <div className="flex-1" style={{ height: height + padding * 2 }}>
          <ManipulableSvgDrawer
            manipulableSvg={manipulableSvg}
            initialState={initialState}
            config={{
              snapRadius: 10,
              transitionWhileDragging: true,
              relativePointerMotion: false,
              animationDuration: 300,
            }}
          />
        </div>
      </div>
    </div>
  );
}

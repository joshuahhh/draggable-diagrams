import { Link } from "react-router-dom";
import { studies } from "./registry";

export const StudyPage = () => {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col">
      <div className="text-center py-10 px-5 max-w-3xl mx-auto">
        <Link to="/" className="text-gray-500 text-sm no-underline">
          <h1 className="text-3xl font-normal text-gray-800">Draggables</h1>
        </Link>
        <p className="text-gray-500 mt-2">Study Examples</p>
      </div>
      <div className="flex flex-col gap-3 px-5 pb-5 max-w-3xl mx-auto flex-1 w-full">
        {studies.map((study) => (
          <Link
            key={study.id}
            to={`/study/${study.id}`}
            className="block px-4 py-3 bg-white rounded-lg border border-gray-200 hover:border-blue-300 hover:shadow-sm no-underline transition-all"
          >
            <span className="text-gray-400 font-mono text-sm mr-3">
              {String(study.number).padStart(2, "0")}
            </span>
            <span className="text-gray-800">{study.name}</span>
          </Link>
        ))}
      </div>
    </div>
  );
};

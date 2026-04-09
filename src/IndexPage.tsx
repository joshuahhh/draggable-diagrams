import { Link } from "react-router-dom";
import { useTitle } from "./useTitle";

export function IndexPage() {
  useTitle("Dragology");
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center py-10 px-5 max-w-3xl mx-auto">
        <h1 className="text-4xl font-normal text-gray-800 mb-12">Declarative Dragging: Explorable Supplement</h1>

        <div className="flex flex-col gap-4 items-center">
          <Link
            to="/figures"
            className="block w-64 px-6 py-4 bg-rose-600 text-white rounded-lg hover:bg-rose-700 transition-colors no-underline text-center font-medium"
          >
            Paper Figures
          </Link>

          <Link
            to="/study"
            className="block w-64 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors no-underline text-center font-medium"
          >
            Study Tasks
          </Link>

          <Link
            to="/demos"
            className="block w-64 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors no-underline text-center font-medium"
          >
            Demo Gallery
          </Link>

        </div>
      </div>
    </div>
  );
}

import { Link } from "react-router-dom";

export function IndexPage() {
  return (
    <div className="min-h-screen bg-gray-50 flex flex-col items-center justify-center">
      <div className="text-center py-10 px-5 max-w-3xl mx-auto">
        <h1 className="text-4xl font-normal text-gray-800 mb-12">
          Draggable Diagrams
        </h1>

        <div className="flex flex-col gap-4 items-center">
          <Link
            to="/docs"
            className="block w-64 px-6 py-4 bg-green-600 text-white rounded-lg hover:bg-green-700 transition-colors no-underline text-center font-medium"
          >
            Documentation
          </Link>

          <Link
            to="/demos"
            className="block w-64 px-6 py-4 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors no-underline text-center font-medium"
          >
            Demos
          </Link>

          <Link
            to="/demos-canvas"
            className="mt-6 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Canvas Demos (Legacy)
          </Link>

          <Link
            to="/pretty-print"
            className="mt-6 text-sm text-gray-600 hover:text-gray-800 underline"
          >
            Pretty Print Demo
          </Link>

          <a
            href="https://github.com/joshuahhh/draggable-diagrams"
            target="_blank"
            rel="noopener noreferrer"
            className="mt-8 text-lg text-gray-700 hover:text-gray-900 no-underline font-semibold"
          >
            ⭐ Fork me on GitHub! ⭐
          </a>
        </div>
      </div>
    </div>
  );
}

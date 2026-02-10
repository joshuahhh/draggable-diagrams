import { MDXProvider } from "@mdx-js/react";
import { ComponentType, useMemo } from "react";
import { Link } from "react-router-dom";

interface MDXPageProps {
  /** The imported MDX component */
  children: ComponentType;
  /** Additional custom components to make available in MDX */
  components?: Record<string, React.ComponentType<any>>;
}

export function MDXPage({ children: Content, components = {} }: MDXPageProps) {
  const allComponents = useMemo(
    () => ({
      h1: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h1 className="text-4xl font-bold mb-6 text-gray-900" {...props} />
      ),
      h2: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h2 className="text-3xl font-bold mb-4 mt-8 text-gray-800" {...props} />
      ),
      h3: (props: React.HTMLAttributes<HTMLHeadingElement>) => (
        <h3
          className="text-2xl font-semibold mb-3 mt-6 text-gray-700"
          {...props}
        />
      ),
      p: (props: React.HTMLAttributes<HTMLParagraphElement>) => (
        <p className="mb-4 text-gray-700 leading-relaxed" {...props} />
      ),
      a: (props: React.AnchorHTMLAttributes<HTMLAnchorElement>) => (
        <a className="text-blue-600 hover:text-blue-800 underline" {...props} />
      ),
      ul: (props: React.HTMLAttributes<HTMLUListElement>) => (
        <ul className="mb-4 ml-6 list-disc text-gray-700" {...props} />
      ),
      ol: (props: React.HTMLAttributes<HTMLOListElement>) => (
        <ol className="mb-4 ml-6 list-decimal text-gray-700" {...props} />
      ),
      li: (props: React.LiHTMLAttributes<HTMLLIElement>) => (
        <li className="mb-2" {...props} />
      ),
      code: (props: React.HTMLAttributes<HTMLElement>) => (
        <code
          className="bg-gray-100 px-1.5 py-0.5 rounded text-sm font-mono text-gray-800"
          {...props}
        />
      ),
      pre: (props: React.HTMLAttributes<HTMLPreElement>) => (
        <pre
          className="bg-gray-100 p-4 rounded-lg mb-4 overflow-x-auto"
          {...props}
        />
      ),
      blockquote: (props: React.BlockquoteHTMLAttributes<HTMLQuoteElement>) => (
        <blockquote
          className="border-l-4 border-gray-300 pl-4 italic mb-4 text-gray-600"
          {...props}
        />
      ),
      ...components,
    }),
    [components],
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-4xl mx-auto px-6 py-12">
        <Link
          to="/"
          className="inline-block mb-8 text-sm text-gray-600 hover:text-gray-800"
        >
          ← Back to home
        </Link>
        <div className="bg-white rounded-lg shadow-sm p-8">
          <MDXProvider components={allComponents}>
            <Content />
          </MDXProvider>
        </div>
      </div>
    </div>
  );
}

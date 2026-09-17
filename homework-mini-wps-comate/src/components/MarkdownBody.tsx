import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";

type Props = {
  text: string;
  streaming?: boolean;
};

export function MarkdownBody({ text, streaming }: Props) {
  const content = text || (streaming ? "…" : "");
  if (!content) return null;

  return (
    <div className="bubble-md">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children }) => (
            <a href={href} target="_blank" rel="noreferrer">
              {children}
            </a>
          ),
          code: ({ className, children, ...props }) => {
            const inline = !String(className || "").includes("language-");
            if (inline) {
              return (
                <code className="md-inline-code" {...props}>
                  {children}
                </code>
              );
            }
            return (
              <code className={className} {...props}>
                {children}
              </code>
            );
          },
          pre: ({ children }) => <pre className="md-pre">{children}</pre>,
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}

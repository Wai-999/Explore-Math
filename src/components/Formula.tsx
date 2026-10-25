import katex from "katex";
import "katex/dist/katex.min.css";
export function Formula({ tex }: { tex: string }) {
  return (
    <div
      className="formula"
      dangerouslySetInnerHTML={{
        __html: katex.renderToString(tex, {
          throwOnError: false,
          output: "htmlAndMathml",
        }),
      }}
    />
  );
}

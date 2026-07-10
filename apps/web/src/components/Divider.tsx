import "./Divider.css";

type DividerProps = {
  className?: string;
};

export function Divider({ className = "" }: DividerProps) {
  return <hr className={`divider-ui ${className}`.trim()} />;
}

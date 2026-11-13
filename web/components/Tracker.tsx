import { Icon } from "./Icons";

const STEPS = ["Case opened", "In review", "Approved", "Released"];

/**
 * The 4-step case tracker. The contract approves and pays in one transaction,
 * so "Approved" and "Released" tick together when the case is paid in full.
 */
export function Tracker({ paid, large }: { paid: boolean; large?: boolean }) {
  const fill = paid ? 100 : 33;
  return (
    <ol className={"tracker" + (large ? " lg" : "")} aria-label={paid ? "Case paid" : "Case in review"}>
      <span className="fill" style={{ width: `calc((100% - ${large ? 56 : 32}px) * ${fill / 100})` }} aria-hidden="true" />
      {STEPS.map((s, i) => {
        const cls = paid || i === 0 ? "done" : i === 1 ? "now" : "";
        return (
          <li key={s} className={cls} aria-current={cls === "now" ? "step" : undefined}>
            <span className="dot">{cls && <Icon name="check" size={large ? 15 : 13} />}</span>
            {s}
          </li>
        );
      })}
    </ol>
  );
}

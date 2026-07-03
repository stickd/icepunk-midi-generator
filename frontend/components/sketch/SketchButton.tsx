import styles from "./sketchTheme.module.css";

type SketchButtonProps = React.ButtonHTMLAttributes<HTMLButtonElement> & {
  size?: "default" | "small";
  variant?: "default" | "ghost";
};

export default function SketchButton({
  className = "",
  size = "default",
  variant = "default",
  ...props
}: SketchButtonProps) {
  const classes = [
    styles.button,
    size === "small" ? styles.buttonSmall : "",
    variant === "ghost" ? styles.buttonGhost : "",
    className,
  ]
    .filter(Boolean)
    .join(" ");

  return <button className={classes} {...props} />;
}

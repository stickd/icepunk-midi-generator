import styles from "./sketchTheme.module.css";

type CreditButtonProps = {
  children: React.ReactNode;
  ariaLabel?: string;
};

export default function CreditButton({ children, ariaLabel }: CreditButtonProps) {
  return (
    <span className={styles.creditButton} aria-label={ariaLabel}>
      <span className={styles.coin} aria-hidden="true" />
      {children}
    </span>
  );
}

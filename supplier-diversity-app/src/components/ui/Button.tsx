import { type ReactNode, type ButtonHTMLAttributes } from 'react';
import { Loader2 } from 'lucide-react';

type ButtonVariant = 'primary' | 'secondary' | 'outline' | 'danger' | 'ghost';
type ButtonSize = 'sm' | 'md' | 'lg';

interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
  loading?: boolean;
  leftIcon?: ReactNode;
  rightIcon?: ReactNode;
  children: ReactNode;
}

const SIZE_CLASSES: Record<ButtonSize, string> = {
  sm: 'px-3 py-1.5 text-xs gap-1.5',
  md: 'px-4 py-2 text-sm gap-2',
  lg: 'px-5 py-2.5 text-base gap-2',
};

const ICON_SIZE: Record<ButtonSize, number> = {
  sm: 14,
  md: 16,
  lg: 18,
};

function useVariantStyle(variant: ButtonVariant): React.CSSProperties {
  switch (variant) {
    case 'primary':
      return {
        backgroundColor: 'var(--color-primary)',
        color: '#ffffff',
        border: '1px solid var(--color-primary)',
      };
    case 'secondary':
      return {
        backgroundColor: 'var(--color-bg-tertiary)',
        color: 'var(--color-text)',
        border: '1px solid var(--color-border)',
      };
    case 'outline':
      return {
        backgroundColor: 'transparent',
        color: 'var(--color-primary)',
        border: '1px solid var(--color-primary)',
      };
    case 'danger':
      return {
        backgroundColor: 'var(--color-danger)',
        color: '#ffffff',
        border: '1px solid var(--color-danger)',
      };
    case 'ghost':
      return {
        backgroundColor: 'transparent',
        color: 'var(--color-text-secondary)',
        border: '1px solid transparent',
      };
  }
}

export function Button({
  variant = 'primary',
  size = 'md',
  loading = false,
  leftIcon,
  rightIcon,
  disabled,
  children,
  className = '',
  style: styleProp,
  ...rest
}: ButtonProps) {
  const isDisabled = disabled || loading;
  const variantStyle = useVariantStyle(variant);
  const iconSize = ICON_SIZE[size];

  return (
    <button
      {...rest}
      disabled={isDisabled}
      className={[
        'inline-flex items-center justify-center font-medium rounded-lg transition-all duration-150 cursor-pointer select-none',
        SIZE_CLASSES[size],
        isDisabled ? 'opacity-50 cursor-not-allowed' : '',
        className,
      ]
        .filter(Boolean)
        .join(' ')}
      style={{
        ...variantStyle,
        ...styleProp,
      }}
    >
      {loading ? (
        <Loader2
          size={iconSize}
          className="animate-spin"
          aria-hidden="true"
        />
      ) : (
        leftIcon && <span aria-hidden="true">{leftIcon}</span>
      )}
      <span>{children}</span>
      {!loading && rightIcon && <span aria-hidden="true">{rightIcon}</span>}
    </button>
  );
}

export default Button;

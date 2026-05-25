import Image from 'next/image'

interface LogoMarkProps {
  size?: number
  className?: string
}

export function LogoMark({ size = 64, className = '' }: LogoMarkProps) {
  return (
    <Image
      src="/logo.jpg"
      alt="Pendacare Logo"
      width={size}
      height={size}
      priority
      className={`h-full w-full object-cover ${className}`}
    />
  )
}

import Image from "next/image";
import iconImage from "@/components/images/Icon.png";
import { APP_NAME } from "@/config";
import { cn } from "@/lib/utils";

interface AppLogoProps {
  className?: string;
  imageClassName?: string;
  priority?: boolean;
}

export function AppLogo({ className, imageClassName, priority = false }: AppLogoProps) {
  return (
    <div className={cn("relative overflow-hidden rounded-[22%] bg-neutral-950 shadow-[0_14px_28px_rgba(0,0,0,0.4)]", className)}>
      <Image
        src={iconImage}
        alt={`${APP_NAME} logo`}
        fill
        sizes="(max-width: 768px) 32px, 56px"
        priority={priority}
        className={cn("object-cover", imageClassName)}
      />
    </div>
  );
}
// components/PopupNotification.tsx
"use client";

import { useEffect, useState } from "react";
import { AlertCircle, CheckCircle, X } from "lucide-react";
import Image from "next/image";

interface PopupNotificationProps {
  message: string;
  type: "error" | "success";
  onClose: () => void;
}

export default function PopupNotification({
  message,
  type,
  onClose,
}: PopupNotificationProps) {
  const [isVisible, setIsVisible] = useState(true);

  useEffect(() => {
    const timer = setTimeout(() => {
      setIsVisible(false);
      onClose();
    }, 500000);

    return () => clearTimeout(timer);
  }, [onClose]);

  if (!isVisible) return null;

  return (
    <div className="fixed inset-0 flex items-center justify-center bg-black bg-opacity-50 z-50">
      <div
        className={`bg-white rounded-lg shadow-xl p-6 max-w-md w-full transform transition-all duration-300 ease-in-out ${
          isVisible ? "scale-100 opacity-100" : "scale-95 opacity-0"
        } ${type === "error" ? "animate-shake" : ""}`}
      >
        <div className="flex items-center justify-between">
          <div className="flex items-center space-x-3">
            {type === "error" ? (
              <div className="relative">
                <AlertCircle className="w-6 h-6 text-red-600" />
                <Image
                  src="/arangocry.svg"
                  alt="Loading"
                  width={250}
                  height={250}
                  className="animate-pulse"
                />
                <div className="absolute -top-1 -right-1 w-2 h-2 bg-red-600 rounded-full animate-pulse"></div>
              </div>
            ) : (
              <CheckCircle className="w-6 h-6 text-green-600" />
            )}
            <span
              className={`text-lg font-medium ${
                type === "error" ? "text-red-800" : "text-green-800"
              }`}
            >
              {message}
            </span>
          </div>
          <button
            onClick={() => {
              setIsVisible(false);
              onClose();
            }}
            className="p-1 rounded-full hover:bg-gray-100 transition-colors"
          >
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </div>
    </div>
  );
}

import Link from "next/link";
import { Beaker, Home, BarChart3, Users } from "lucide-react";

export default function Navigation() {
  return (
    <nav className="fixed top-0 left-0 z-40 h-screen w-64 bg-white shadow-lg">
      <div className="p-6">
        <h1 className="text-xl font-bold text-indigo-700">
          MedGraph Navigator
        </h1>
        <p className="text-xs text-gray-500 mt-1">
          Patient Journey & Risk Analytics
        </p>
      </div>
      <div className="px-4">
        <div className="space-y-1">
          <NavItem href="/" icon={<Home size={20} />} text="Dashboard" />
          <NavItem
            href="/patients"
            icon={<Users size={20} />}
            text="Patient Explorer"
          />
          <NavItem
            href="/analytics"
            icon={<BarChart3 size={20} />}
            text="Analytics"
          />
          <NavItem
            href="/query"
            icon={<Beaker size={20} />}
            text="Query Interface"
          />
        </div>
      </div>
    </nav>
  );
}

function NavItem({
  href,
  icon,
  text,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
}) {
  return (
    <Link
      href={href}
      className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-700 hover:text-indigo-700 hover:bg-indigo-50 group transition-colors"
    >
      <span className="mr-3 text-gray-500 group-hover:text-indigo-700">
        {icon}
      </span>
      {text}
    </Link>
  );
}

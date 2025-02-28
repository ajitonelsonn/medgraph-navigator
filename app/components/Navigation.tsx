import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  Beaker,
  Home,
  BarChart3,
  Users,
  ExternalLink as ExternalLinkIcon,
  Heart,
  Github,
  Database,
  Award,
  ChevronRight,
  FileText,
  Menu,
  X,
} from "lucide-react";
import { useState, useEffect, useRef } from "react";

export default function Navigation() {
  const pathname = usePathname();
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const navRef = useRef<HTMLDivElement>(null);

  // Close navigation when clicking outside
  useEffect(() => {
    function handleClickOutside(event: MouseEvent) {
      if (
        navRef.current &&
        !navRef.current.contains(event.target as Node) &&
        window.innerWidth < 768
      ) {
        setMobileMenuOpen(false);
      }
    }

    // Close navigation when route changes
    setMobileMenuOpen(false);

    // Add event listener for clicks
    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [pathname]);

  // Close navigation when escape key is pressed
  useEffect(() => {
    function handleEscapeKey(event: KeyboardEvent) {
      if (event.key === "Escape" && mobileMenuOpen) {
        setMobileMenuOpen(false);
      }
    }

    document.addEventListener("keydown", handleEscapeKey);
    return () => {
      document.removeEventListener("keydown", handleEscapeKey);
    };
  }, [mobileMenuOpen]);

  return (
    <>
      {/* Mobile menu button */}
      <div className="fixed top-4 left-4 z-50 md:hidden">
        <button
          onClick={() => setMobileMenuOpen(!mobileMenuOpen)}
          className="p-2 rounded-md bg-white shadow-md text-gray-700 hover:text-indigo-600"
          aria-label={mobileMenuOpen ? "Close menu" : "Open menu"}
        >
          {mobileMenuOpen ? <X size={24} /> : <Menu size={24} />}
        </button>
      </div>

      {/* Navigation sidebar */}
      <nav
        ref={navRef}
        className={`fixed top-0 left-0 z-40 h-screen w-64 bg-white shadow-lg transform transition-transform duration-300 ease-in-out ${
          mobileMenuOpen
            ? "translate-x-0"
            : "-translate-x-full md:translate-x-0"
        }`}
      >
        <div className="h-full flex flex-col">
          {/* Logo and title */}
          <div className="p-6 border-b">
            <div className="flex items-center">
              <div className="flex items-center justify-center w-10 h-10 rounded-lg bg-indigo-100 text-indigo-700 mr-3">
                <Heart size={20} />
              </div>
              <div>
                <h1 className="text-xl font-bold text-indigo-700">
                  MedGraph Navigator
                </h1>
                <p className="text-xs text-gray-500 mt-1">
                  Patient Journey & Risk Analytics
                </p>
              </div>
            </div>
          </div>

          {/* Navigation sections */}
          <div className="flex-1 overflow-y-auto py-6 px-4 space-y-8">
            {/* Main navigation */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Main
              </h3>
              <div className="mt-3 space-y-1">
                <NavItem
                  href="/"
                  icon={<Home size={20} />}
                  text="Home"
                  isActive={pathname === "/"}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <NavItem
                  href="/patients"
                  icon={<Users size={20} />}
                  text="Patient Explorer"
                  isActive={pathname === "/patients"}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <NavItem
                  href="/analytics"
                  icon={<BarChart3 size={20} />}
                  text="Analytics"
                  isActive={pathname === "/analytics"}
                  onClick={() => setMobileMenuOpen(false)}
                />
                <NavItem
                  href="/query"
                  icon={<Beaker size={20} />}
                  text="Query Interface"
                  isActive={pathname === "/query"}
                  onClick={() => setMobileMenuOpen(false)}
                />
              </div>
            </div>

            {/* Resources section */}
            <div>
              <h3 className="px-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                Resources
              </h3>
              <div className="mt-3 space-y-1">
                <ExternalNavItem
                  href="https://huggingface.co/datasets/ajitonelson/synthetic-mass-health-data"
                  icon={<Database size={20} />}
                  text="Dataset"
                />
                <ExternalNavItem
                  href="https://github.com/ajitonelsonn/medgraph-navigator"
                  icon={<Github size={20} />}
                  text="Source Code"
                />
                <ExternalNavItem
                  href="https://synthea.mitre.org/about"
                  icon={<FileText size={20} />}
                  text="Synthea Healthcare Dataset"
                />
              </div>
            </div>
          </div>

          {/* Footer with project links */}
          <div className="p-4 border-t">
            <div className="space-y-3">
              <Link
                href="https://arangodbhackathon.devpost.com/"
                target="_blank"
                className="flex items-center justify-center px-4 py-2 bg-indigo-600 hover:bg-indigo-700 rounded-lg text-white transition duration-150"
              >
                <Award className="h-5 w-5 mr-2" />
                ArangoDB Hackathon
              </Link>

              <Link
                href="https://arangodb.com/"
                target="_blank"
                className="flex items-center justify-center px-4 py-2 bg-gray-100 hover:bg-gray-200 rounded-lg text-gray-800 transition duration-150"
              >
                <Database className="h-5 w-5 mr-2 text-indigo-600" />
                Visit ArangoDB.com
              </Link>

              <div className="text-center text-sm text-gray-500 pt-1">
                Made with ❤️ in Timor-Leste 🇹🇱
              </div>
            </div>
          </div>
        </div>
      </nav>

      {/* Mobile overlay */}
      {mobileMenuOpen && (
        <div
          className="fixed inset-0 bg-black bg-opacity-50 z-30 md:hidden"
          onClick={() => setMobileMenuOpen(false)}
          aria-hidden="true"
        />
      )}
    </>
  );
}

function NavItem({
  href,
  icon,
  text,
  isActive = false,
  onClick,
}: {
  href: string;
  icon: React.ReactNode;
  text: string;
  isActive?: boolean;
  onClick?: () => void;
}) {
  return (
    <Link
      href={href}
      onClick={onClick}
      className={`flex items-center px-3 py-2 text-sm font-medium rounded-md group transition-colors ${
        isActive
          ? "bg-indigo-50 text-indigo-700"
          : "text-gray-700 hover:text-indigo-700 hover:bg-indigo-50"
      }`}
    >
      <span
        className={`mr-3 ${
          isActive
            ? "text-indigo-700"
            : "text-gray-500 group-hover:text-indigo-700"
        }`}
      >
        {icon}
      </span>
      {text}
      {isActive && <ChevronRight className="ml-auto h-4 w-4 text-indigo-700" />}
    </Link>
  );
}

function ExternalNavItem({
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
      target="_blank"
      className="flex items-center px-3 py-2 text-sm font-medium rounded-md text-gray-600 hover:text-indigo-600 hover:bg-indigo-50 group transition-colors"
    >
      <span className="mr-3 text-gray-400 group-hover:text-indigo-600">
        {icon}
      </span>
      {text}
      <ExternalLinkIcon className="ml-auto h-3 w-3 text-gray-400 group-hover:text-indigo-600" />
    </Link>
  );
}

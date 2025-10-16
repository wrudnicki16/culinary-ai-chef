import Link from "next/link";

export function Footer() {
  return (
    <footer className="bg-gray-100 mt-12">
      <div className="max-w-7xl mx-auto px-4 py-8 sm:px-6 lg:px-8">
        <div className="grid grid-cols-1 md:grid-cols-4 gap-8">
          <div>
            <h3 className="text-lg font-heading font-semibold mb-4">
              AI Recipe Generator
            </h3>
            <p className="text-sm text-gray-600">
              Your personal AI chef for healthy, personalized recipes tailored to
              your dietary needs and preferences.
            </p>
          </div>
          <div>
            <h4 className="font-medium mb-4">Features</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="#" className="hover:text-primary">
                  AI Recipe Creation
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Dietary Restrictions
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Meal Planning
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Grocery Lists
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Resources</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="#" className="hover:text-primary">
                  Blog
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Nutrition Guide
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Cooking Tips
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  FAQs
                </Link>
              </li>
            </ul>
          </div>
          <div>
            <h4 className="font-medium mb-4">Company</h4>
            <ul className="space-y-2 text-sm text-gray-600">
              <li>
                <Link href="#" className="hover:text-primary">
                  About Us
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Contact
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Privacy Policy
                </Link>
              </li>
              <li>
                <Link href="#" className="hover:text-primary">
                  Terms of Service
                </Link>
              </li>
            </ul>
          </div>
        </div>
        <div className="mt-8 pt-8 border-t border-gray-200 text-sm text-gray-500 text-center">
          <p>&copy; {new Date().getFullYear()} AI Recipe Generator. All rights reserved.</p>
        </div>
      </div>
    </footer>
  );
}

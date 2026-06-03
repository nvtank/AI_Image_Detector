import type { Metadata } from "next";
import { Inter } from "next/font/google";
import "./globals.css";
import Navbar from "@/components/Navbar";
import Footer from "@/components/Footer";
import { AuthProvider } from "@/context/AuthContext";
import { NotificationProvider } from "@/context/NotificationContext";
import { LanguageProvider } from "@/context/LanguageContext";

const inter = Inter({
  subsets: ["latin", "vietnamese"],
  variable: "--font-inter",
  display: "swap",
  weight: ["400", "500", "600", "700", "800", "900"],
});

export const metadata: Metadata = {
  title: "AI Image Detector — Detect AI-Generated Images",
  description:
    "Advanced AI-powered image detection system using Deep Learning (EfficientNetV2, ConvNeXt, ResNet50) and Gemini AI hybrid analysis. Detect AI-generated images with 98.6% F1 accuracy.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="vi">
      <body
        className={`${inter.variable}`}
        style={{ minHeight: "100vh", display: "flex", flexDirection: "column" }}
      >
        <LanguageProvider>
          <AuthProvider>
            <NotificationProvider>
              <Navbar />
              <main style={{ flex: 1 }}>{children}</main>
              <Footer />
            </NotificationProvider>
          </AuthProvider>
        </LanguageProvider>
      </body>
    </html>
  );
}

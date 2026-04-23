import { useState } from "react";
import { useTranslation } from "react-i18next";

import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { Phone, Mail, Building2, User, MessageSquare  } from 'lucide-react';
import { toast } from "sonner";
import { useLocation } from "wouter";
import { trpc } from "@/lib/trpc";

export default function Contact() {
  const { t } = useTranslation();
  const [, setLocation] = useLocation();
  const [_loading, _setLoading] = useState(false);
  const [formData, setFormData] = useState({
    name: "",
    email: "",
    phone: "",
    company: "",
    message: ""
  });

  const [errors, setErrors] = useState<Record<string, string>>({});

  const validateForm = () => {
    const newErrors: Record<string, string> = {};

    if (!formData.name.trim()) {
      newErrors['name'] = t("contact.required");
    }

    if (!formData.email.trim()) {
      newErrors['email'] = t("contact.required");
    } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(formData.email)) {
      newErrors['email'] = t("contact.invalid_email");
    }

    if (!formData.message.trim()) {
      newErrors['message'] = t("contact.required");
    }

    setErrors(newErrors);
    return Object.keys(newErrors).length === 0;
  };

  const contactMutation = trpc.contact.submit.useMutation({
    onSuccess: () => {
      toast.success(t("contact.success"));

      // Reset form
      setFormData({
        name: "",
        email: "",
        phone: "",
        company: "",
        message: ""
      });

      // Redirect to home after 2 seconds
      setTimeout(() => {
        setLocation("/");
      }, 2000);
    },
    onError: (error) => {
      console.error("Error sending contact request:", error);
      toast.error(t("contact.error"));
    },
  });

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    if (!validateForm()) {
      return;
    }

    contactMutation.mutate(formData);
  };

  const handleChange = (field: string, value: string) => {
    setFormData(prev => ({ ...prev, [field]: value }));
    // Clear error when user starts typing
    if (errors[field]) {
      setErrors(prev => ({ ...prev, [field]: "" }));
    }
  };

  return (
    <div className="min-h-screen bg-gradient-to-b from-background to-muted/20" data-main-content>
      {/* Header */}
      <header className="border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/60">
        <div className="container flex h-16 items-center justify-between">
          <div className="flex items-center gap-2 cursor-pointer" onClick={() => setLocation("/")}>
            <Phone className="h-6 w-6 text-primary" />
            <span className="text-xl font-bold">Servicall CRM v2</span>
          </div>
          <Button onClick={() => setLocation("/login")}>
            {t("nav.dashboard")}
          </Button>
        </div>
      </header>

      {/* Contact Form Section */}
      <section className="container py-12 md:py-24">
        <div className="max-w-2xl mx-auto">
          <Card>
            <CardHeader className="text-center">
              <CardTitle className="text-3xl">{t("contact.title")}</CardTitle>
              <CardDescription className="text-lg">
                {t("contact.subtitle")}
              </CardDescription>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleSubmit} className="space-y-6">
                {/* Name */}
                <div className="space-y-2">
                  <Label htmlFor="name" className="flex items-center gap-2">
                    <User className="h-4 w-4" />
                    {t("contact.name")}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="name"
                    value={formData.name}
                    onChange={(e: any) => handleChange("name", e.target.value)}
                    className={errors['name'] ? "border-destructive" : ""}
                  />
                  {errors['name'] && (
                    <p className="text-sm text-destructive">{errors['name']}</p>
                  )}
                </div>

                {/* Email */}
                <div className="space-y-2">
                  <Label htmlFor="email" className="flex items-center gap-2">
                    <Mail className="h-4 w-4" />
                    {t("contact.email")}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Input
                    id="email"
                    type="email"
                    value={formData.email}
                    onChange={(e: any) => handleChange("email", e.target.value)}
                    className={errors['email'] ? "border-destructive" : ""}
                  />
                  {errors['email'] && (
                    <p className="text-sm text-destructive">{errors['email']}</p>
                  )}
                </div>

                {/* Phone */}
                <div className="space-y-2">
                  <Label htmlFor="phone" className="flex items-center gap-2">
                    <Phone className="h-4 w-4" />
                    {t("contact.phone")}
                  </Label>
                  <Input
                    id="phone"
                    type="tel"
                    value={formData.phone}
                    onChange={(e: any) => handleChange("phone", e.target.value)}
                  />
                </div>

                {/* Company */}
                <div className="space-y-2">
                  <Label htmlFor="company" className="flex items-center gap-2">
                    <Building2 className="h-4 w-4" />
                    {t("contact.company")}
                  </Label>
                  <Input
                    id="company"
                    value={formData.company}
                    onChange={(e: any) => handleChange("company", e.target.value)}
                  />
                </div>

                {/* Message */}
                <div className="space-y-2">
                  <Label htmlFor="message" className="flex items-center gap-2">
                    <MessageSquare className="h-4 w-4" />
                    {t("contact.message")}
                    <span className="text-destructive">*</span>
                  </Label>
                  <Textarea
                    id="message"
                    rows={6}
                    value={formData.message}
                    onChange={(e: any) => handleChange("message", e.target.value)}
                    className={errors['message'] ? "border-destructive" : ""}
                  />
                  {errors['message'] && (
                    <p className="text-sm text-destructive">{errors['message']}</p>
                  )}
                </div>

                {/* Submit Button */}
                <Button
                  type="submit"
                  className="w-full"
                  size="lg"
                  disabled={contactMutation.isPending}
                >
                  {contactMutation.isPending ? (
                    <div className="flex items-center gap-2">
                      <div className="w-4 h-4 border-2 border-primary-foreground border-t-transparent rounded-full animate-spin"></div>
                      <span>{t("actions.save")}...</span>
                    </div>
                  ) : (
                    t("contact.submit")
                  )}
                </Button>
              </form>
            </CardContent>
          </Card>
        </div>
      </section>

      {/* Footer */}
      <footer className="border-t py-6 md:py-8">
        <div className="container flex flex-col items-center justify-between gap-4 md:flex-row">
          <p className="text-sm text-muted-foreground">
            © 2026 Servicall CRM v2. {t("languages.fr") === "Français" ? "Tous droits réservés." : "All rights reserved."}
          </p>
          <div className="flex gap-4 text-sm text-muted-foreground">
            <button onClick={() => setLocation("/privacy")} className="hover:text-foreground cursor-pointer">
              {t("languages.fr") === "Français" ? "Confidentialité" : "Privacy"}
            </button>
            <button onClick={() => setLocation("/terms")} className="hover:text-foreground cursor-pointer">
              {t("languages.fr") === "Français" ? "Conditions" : "Terms"}
            </button>
            <button onClick={() => setLocation("/contact")} className="hover:text-foreground cursor-pointer">Support</button>
          </div>
        </div>
      </footer>
    </div>
  );
}

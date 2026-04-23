// import React from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import * as z from "zod";
import { useTenant } from "@/contexts/TenantContext";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogFooter,
  DialogDescription,
} from "@/components/ui/dialog";
import {
  Form,
  FormControl,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
import { getUserFriendlyErrorMessage } from "@/lib/errorMessages";
import { Loader2, UserPlus, Building2, Phone, Mail, FileText  } from 'lucide-react';

const prospectSchema = z.object({
  firstName: z.string().min(1, "Le prénom est requis"),
  lastName: z.string().min(1, "Le nom est requis"),
  email: z.string().email("Email invalide").optional().or(z.literal("")),
  phone: z.string().optional(),
  company: z.string().optional(),
  notes: z.string().optional(),
});

type ProspectFormValues = z.infer<typeof prospectSchema>;

interface ProspectDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onSuccess?: () => void;
}

export function ProspectDialog({ open, onOpenChange, onSuccess }: ProspectDialogProps) {
  const utils = trpc.useUtils();
  const { tenantId } = useTenant();
  
  const form = useForm<ProspectFormValues>({
    resolver: zodResolver(prospectSchema),
    defaultValues: {
      firstName: "",
      lastName: "",
      email: "",
      phone: "",
      company: "",
      notes: "",
    },
  });

  const createProspect = trpc.business.prospect.create.useMutation({
    onSuccess: (data: Record<string, unknown>) => {
      const prospectName = `${data.firstName} ${data.lastName}`.trim();
      toast.success("✅ Prospect créé avec succès", {
        description: `${prospectName} a été ajouté à votre pipeline`,
        duration: 4000,
      });
      
      utils.business.prospect.list.invalidate();
      onOpenChange(false);
      form.reset();
      if (onSuccess) onSuccess();
    },
    onError: (error) => {
      toast.error("❌ Erreur lors de la création", {
        description: getUserFriendlyErrorMessage(error),
        duration: 5000,
      });
    },
  });

  function onSubmit(values: ProspectFormValues) {
    if (!tenantId) {
      toast.error("Erreur : aucune entreprise sélectionnée");
      return;
    }
    createProspect.mutate({ 
      ...values, 
      // tenantId est géré par le contexte serveur (ctx.tenantId)
      email: values.email || undefined,
      phone: values.phone || undefined,
      company: values.company || undefined,
      notes: values.notes || undefined
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-[550px] p-0 overflow-hidden border-none shadow-2xl">
        <div className="bg-primary px-6 py-8 text-primary-foreground">
          <DialogHeader>
            <div className="flex items-center gap-3 mb-2">
              <div className="p-2 bg-white/20 rounded-lg">
                <UserPlus className="w-6 h-6" />
              </div>
              <DialogTitle className="text-2xl font-black tracking-tight text-white">Nouveau Prospect</DialogTitle>
            </div>
            <DialogDescription className="text-primary-foreground/80 font-medium">
              Ajoutez manuellement un contact à votre pipeline commercial.
            </DialogDescription>
          </DialogHeader>
        </div>

        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="p-6 space-y-6 bg-white">
            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="firstName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Prénom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Jean" className="bg-muted/30 border-none focus-visible:ring-primary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="lastName"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider">Nom *</FormLabel>
                    <FormControl>
                      <Input placeholder="Dupont" className="bg-muted/30 border-none focus-visible:ring-primary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <div className="grid grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <Mail className="w-3 h-3" /> Email
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="jean@exemple.com" className="bg-muted/30 border-none focus-visible:ring-primary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              <FormField
                control={form.control}
                name="phone"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                      <Phone className="w-3 h-3" /> Téléphone
                    </FormLabel>
                    <FormControl>
                      <Input placeholder="06 12 34 56 78" className="bg-muted/30 border-none focus-visible:ring-primary" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>

            <FormField
              control={form.control}
              name="company"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    <Building2 className="w-3 h-3" /> Entreprise
                  </FormLabel>
                  <FormControl>
                    <Input placeholder="Nom de la société" className="bg-muted/30 border-none focus-visible:ring-primary" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <FormField
              control={form.control}
              name="notes"
              render={({ field }) => (
                <FormItem>
                  <FormLabel className="text-xs font-bold uppercase text-muted-foreground tracking-wider flex items-center gap-2">
                    <FileText className="w-3 h-3" /> Notes & Contexte
                  </FormLabel>
                  <FormControl>
                    <Textarea 
                      placeholder="Informations utiles pour le premier appel..." 
                      className="resize-none bg-muted/30 border-none focus-visible:ring-primary min-h-[100px]" 
                      {...field} 
                    />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />

            <DialogFooter className="pt-4 border-t gap-2">
              <Button 
                type="button" 
                variant="ghost" 
                className="font-bold text-muted-foreground hover:bg-muted"
                onClick={() => onOpenChange(false)}
                disabled={createProspect.isPending}
              >
                Annuler
              </Button>
              <Button 
                type="submit" 
                className="font-bold px-8 shadow-lg shadow-primary/20"
                disabled={createProspect.isPending}
              >
                {createProspect.isPending ? (
                  <>
                    <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                    Création...
                  </>
                ) : (
                  "Créer le prospect"
                )}
              </Button>
            </DialogFooter>
          </form>
        </Form>
      </DialogContent>
    </Dialog>
  );
}
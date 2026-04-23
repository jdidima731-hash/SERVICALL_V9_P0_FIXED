import { MoreVertical,
  Phone,
  MessageSquare,
  Calendar,
  Trash2,
 } from 'lucide-react';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Button } from "@/components/ui/button";
import { trpc } from "@/lib/trpc";
import { toast } from "sonner";
// import { useTenant } from "@/contexts/TenantContext";

interface CallContextMenuProps {
  callId: string;
  contactName: string;
  phoneNumber: string;
  onCall?: (phoneNumber: string) => void;
  onAddNote?: (callId: string) => void;
  onScheduleFollowup?: (callId: string) => void;
  onDelete?: (callId: string) => void;
}

export function CallContextMenu({
  callId,
  contactName,
  phoneNumber,
  onCall,
  onAddNote,
  onScheduleFollowup,
  onDelete,
}: CallContextMenuProps) {
  // const {_tenantId} = useTenant();
  const utils = trpc.useUtils();
  
  const deleteMutation = trpc.communication.calls.delete.useMutation({
    onSuccess: () => {
      
      utils.communication.calls.list.invalidate();
      toast.success("Appel supprimé de l'historique");
    },
    onError: (error) => {
      toast.error(`Erreur lors de la suppression: ${error.message}`);
    }
  });

  const handleDelete = async () => {
    await deleteMutation.mutateAsync({ callId: parseInt(callId) });
    onDelete?.(callId);
  };

  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button variant="ghost" size="sm" className="h-8 w-8 p-0">
          <MoreVertical className="h-4 w-4" />
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-48">
        <DropdownMenuItem
          onClick={() => {
            onCall?.(phoneNumber);
            toast.success(`Appel vers ${contactName} initié`);
          }}
          className="gap-2 cursor-pointer"
        >
          <Phone className="h-4 w-4" />
          <span>Rappeler</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onAddNote?.(callId)}
          className="gap-2 cursor-pointer"
        >
          <MessageSquare className="h-4 w-4" />
          <span>Ajouter une note</span>
        </DropdownMenuItem>

        <DropdownMenuItem
          onClick={() => onScheduleFollowup?.(callId)}
          className="gap-2 cursor-pointer"
        >
          <Calendar className="h-4 w-4" />
          <span>Planifier un suivi</span>
        </DropdownMenuItem>

        <DropdownMenuSeparator />

        <DropdownMenuItem
          onClick={handleDelete}
          className="gap-2 cursor-pointer text-red-600 focus:text-red-600 focus:bg-red-50"
        >
          <Trash2 className="h-4 w-4" />
          <span>Supprimer</span>
        </DropdownMenuItem>
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export default CallContextMenu;
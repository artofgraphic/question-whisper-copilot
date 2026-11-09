import { FileDown, FileText, Share2 } from "lucide-react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { downloadDoc, downloadPdf, shareSession } from "@/lib/export";
import type { Session } from "@/lib/store";

export function ExportButtons({ session }: { session: Session }) {
  const disabled = session.qas.length === 0;
  return (
    <div className="flex flex-wrap gap-2">
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => { if (!downloadPdf(session)) toast.error("Allow pop-ups to save as PDF."); }}>
        <FileDown className="mr-1 h-3.5 w-3.5" />PDF
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={() => downloadDoc(session)}>
        <FileText className="mr-1 h-3.5 w-3.5" />Word
      </Button>
      <Button size="sm" variant="secondary" disabled={disabled} onClick={async () => {
        const r = await shareSession(session);
        if (r === "copied") toast.success("Summary copied — paste it anywhere to share");
      }}>
        <Share2 className="mr-1 h-3.5 w-3.5" />Share
      </Button>
    </div>
  );
}

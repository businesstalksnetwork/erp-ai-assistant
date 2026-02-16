import { useState } from "react";
import { useSelectedCompany } from "@/lib/company-context";
import { useServiceCatalog, ServiceCatalogItem } from "@/hooks/useServiceCatalog";
import { ServiceCatalogDialog } from "@/components/ServiceCatalogDialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Badge } from "@/components/ui/badge";
import { Plus, Search, Pencil, Trash2, Package, Wrench } from "lucide-react";

type FilterType = "all" | "services" | "products";

export default function ServiceCatalog() {
  const { selectedCompany } = useSelectedCompany();
  const { services, isLoading, createService, updateService, deleteService } =
    useServiceCatalog(selectedCompany?.id || null);

  const [dialogOpen, setDialogOpen] = useState(false);
  const [editingItem, setEditingItem] = useState<ServiceCatalogItem | null>(null);
  const [deleteItem, setDeleteItem] = useState<ServiceCatalogItem | null>(null);
  const [filter, setFilter] = useState<FilterType>("all");
  const [searchQuery, setSearchQuery] = useState("");

  const filteredServices = services.filter((service) => {
    const matchesFilter =
      filter === "all" || service.item_type === filter;
    const matchesSearch =
      service.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
      service.description?.toLowerCase().includes(searchQuery.toLowerCase());
    return matchesFilter && matchesSearch;
  });

  const handleSave = (data: {
    name: string;
    description: string | null;
    item_type: "services" | "products";
    default_unit_price: number | null;
    default_foreign_price: number | null;
    foreign_currency: string | null;
    unit: string;
    is_active: boolean;
  }) => {
    if (editingItem) {
      updateService.mutate(
        { id: editingItem.id, ...data },
        {
          onSuccess: () => {
            setDialogOpen(false);
            setEditingItem(null);
          },
        }
      );
    } else {
      createService.mutate(
        { ...data, company_id: selectedCompany!.id },
        {
          onSuccess: () => {
            setDialogOpen(false);
          },
        }
      );
    }
  };

  const handleEdit = (item: ServiceCatalogItem) => {
    setEditingItem(item);
    setDialogOpen(true);
  };

  const handleDelete = () => {
    if (deleteItem) {
      deleteService.mutate(deleteItem.id, {
        onSuccess: () => setDeleteItem(null),
      });
    }
  };

  const formatPrice = (price: number | null) => {
    if (price === null) return "-";
    return new Intl.NumberFormat("sr-RS", {
      minimumFractionDigits: 2,
      maximumFractionDigits: 2,
    }).format(price);
  };

  if (!selectedCompany) {
    return (
      <div className="p-6">
        <Card>
          <CardContent className="py-10 text-center text-muted-foreground">
            Molimo izaberite firmu da biste videli šifarnik.
          </CardContent>
        </Card>
      </div>
    );
  }

  return (
    <div className="p-6 space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-2xl font-bold">Šifarnik usluga i proizvoda</h1>
          <p className="text-muted-foreground">
            Upravljajte stavkama koje koristite pri kreiranju faktura
          </p>
        </div>
        <Button onClick={() => { setEditingItem(null); setDialogOpen(true); }}>
          <Plus className="h-4 w-4 mr-2" />
          Nova stavka
        </Button>
      </div>

      <Card>
        <CardHeader className="pb-4">
          <div className="flex flex-col sm:flex-row gap-4">
            <div className="flex gap-2">
              <Button
                variant={filter === "all" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("all")}
              >
                Sve
              </Button>
              <Button
                variant={filter === "services" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("services")}
              >
                <Wrench className="h-4 w-4 mr-1" />
                Usluge
              </Button>
              <Button
                variant={filter === "products" ? "default" : "outline"}
                size="sm"
                onClick={() => setFilter("products")}
              >
                <Package className="h-4 w-4 mr-1" />
                Proizvodi
              </Button>
            </div>
            <div className="relative flex-1 max-w-sm">
              <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Pretraži šifarnik..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="text-center py-10 text-muted-foreground">
              Učitavanje...
            </div>
          ) : filteredServices.length === 0 ? (
            <div className="text-center py-10 text-muted-foreground">
              {searchQuery || filter !== "all"
                ? "Nema stavki koje odgovaraju pretrazi."
                : "Šifarnik je prazan. Dodajte prvu stavku."}
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Naziv</TableHead>
                    <TableHead>Tip</TableHead>
                    <TableHead>Jedinica</TableHead>
                    <TableHead className="text-right">Cena (RSD)</TableHead>
                    <TableHead className="text-right">Cena (strana)</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Akcije</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {filteredServices.map((service) => (
                    <TableRow key={service.id}>
                      <TableCell>
                        <div>
                          <div className="font-medium">{service.name}</div>
                          {service.description && (
                            <div className="text-sm text-muted-foreground truncate max-w-[200px]">
                              {service.description}
                            </div>
                          )}
                        </div>
                      </TableCell>
                      <TableCell>
                        <Badge variant="outline">
                          {service.item_type === "services" ? (
                            <>
                              <Wrench className="h-3 w-3 mr-1" />
                              Usluga
                            </>
                          ) : (
                            <>
                              <Package className="h-3 w-3 mr-1" />
                              Proizvod
                            </>
                          )}
                        </Badge>
                      </TableCell>
                      <TableCell>{service.unit || "-"}</TableCell>
                      <TableCell className="text-right">
                        {formatPrice(service.default_unit_price)}
                      </TableCell>
                      <TableCell className="text-right">
                        {service.default_foreign_price != null
                          ? `${formatPrice(service.default_foreign_price)} ${service.foreign_currency || "EUR"}`
                          : "-"}
                      </TableCell>
                      <TableCell>
                        <Badge variant={service.is_active ? "default" : "secondary"}>
                          {service.is_active ? "Aktivna" : "Neaktivna"}
                        </Badge>
                      </TableCell>
                      <TableCell className="text-right">
                        <div className="flex justify-end gap-2">
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => handleEdit(service)}
                          >
                            <Pencil className="h-4 w-4" />
                          </Button>
                          <Button
                            variant="ghost"
                            size="icon"
                            onClick={() => setDeleteItem(service)}
                          >
                            <Trash2 className="h-4 w-4 text-destructive" />
                          </Button>
                        </div>
                      </TableCell>
                    </TableRow>
                  ))}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <ServiceCatalogDialog
        open={dialogOpen}
        onOpenChange={(open) => {
          setDialogOpen(open);
          if (!open) setEditingItem(null);
        }}
        onSave={handleSave}
        initialData={editingItem}
        isLoading={createService.isPending || updateService.isPending}
      />

      <AlertDialog open={!!deleteItem} onOpenChange={() => setDeleteItem(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Obrisati stavku?</AlertDialogTitle>
            <AlertDialogDescription>
              Da li ste sigurni da želite da obrišete "{deleteItem?.name}"? Ova
              akcija se ne može poništiti.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Otkaži</AlertDialogCancel>
            <AlertDialogAction
              onClick={handleDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              Obriši
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}

"use client";

import { useState, useEffect } from "react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from "@/components/ui/table";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { DeviceRegisterDialog } from "@/components/iot/device-register-dialog";
import { MoreVertical, Plus, AlertCircle, Zap } from "lucide-react";

interface Device {
  id: string;
  name: string;
  deviceType: string;
  serialNumber: string;
  isActive: boolean;
  lastReadingAt: string | null;
  facility: { id: string; name: string } | null;
  credentials: Array<{ id: string; prefix: string; createdAt: string }>;
  _count: { readings: number };
}

interface Facility {
  id: string;
  name: string;
}

interface Props {
  orgId: string;
  facilities: Facility[];
}

const DEVICE_TYPE_LABELS: Record<string, { label: string; icon: React.ReactNode }> = {
  electricity_meter: { label: "Electricity Meter", icon: <Zap className="h-4 w-4" /> },
  gas_meter: { label: "Gas Meter", icon: <Zap className="h-4 w-4" /> },
  fuel_pump: { label: "Fuel Pump", icon: <Zap className="h-4 w-4" /> },
  water_meter: { label: "Water Meter", icon: <Zap className="h-4 w-4" /> },
};

export function IoTDevicesSettings({ orgId, facilities }: Props) {
  const [devices, setDevices] = useState<Device[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [dialogOpen, setDialogOpen] = useState(false);

  useEffect(() => {
    loadDevices();
  }, []);

  const loadDevices = async () => {
    try {
      setLoading(true);
      const response = await fetch(`/api/orgs/${orgId}/iot-devices`);
      if (!response.ok) throw new Error("Failed to load devices");
      const data = await response.json();
      setDevices(data.devices);
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    } finally {
      setLoading(false);
    }
  };

  const handleDeleteDevice = async (deviceId: string) => {
    if (!confirm("Are you sure you want to deactivate this device?")) return;

    try {
      const response = await fetch(
        `/api/orgs/${orgId}/iot-devices/${deviceId}`,
        { method: "DELETE" }
      );
      if (!response.ok) throw new Error("Failed to delete device");
      loadDevices();
    } catch (err) {
      setError(err instanceof Error ? err.message : "An error occurred");
    }
  };

  const deviceTypeInfo = (deviceType: string) => {
    return DEVICE_TYPE_LABELS[deviceType] || { label: deviceType, icon: null };
  };

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle>IoT Devices</CardTitle>
              <CardDescription>
                Manage connected meters and sensors for automatic emissions tracking
              </CardDescription>
            </div>
            <Button onClick={() => setDialogOpen(true)} className="gap-2">
              <Plus className="h-4 w-4" />
              Register Device
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          {error && (
            <Alert variant="destructive" className="mb-4">
              <AlertCircle className="h-4 w-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}

          {loading ? (
            <div className="text-center py-8 text-gray-500">Loading devices...</div>
          ) : devices.length === 0 ? (
            <div className="text-center py-8">
              <p className="text-gray-600 mb-4">No IoT devices registered yet</p>
              <Button onClick={() => setDialogOpen(true)} variant="outline">
                Register First Device
              </Button>
            </div>
          ) : (
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    <TableHead>Name</TableHead>
                    <TableHead>Type</TableHead>
                    <TableHead>Serial Number</TableHead>
                    <TableHead>Facility</TableHead>
                    <TableHead>Last Reading</TableHead>
                    <TableHead>Readings</TableHead>
                    <TableHead>Status</TableHead>
                    <TableHead className="text-right">Actions</TableHead>
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {devices.map((device) => {
                    const typeInfo = deviceTypeInfo(device.deviceType);
                    const lastReading = device.lastReadingAt
                      ? new Date(device.lastReadingAt).toLocaleDateString()
                      : "Never";

                    return (
                      <TableRow key={device.id}>
                        <TableCell className="font-medium">{device.name}</TableCell>
                        <TableCell className="flex items-center gap-2">
                          {typeInfo.icon}
                          {typeInfo.label}
                        </TableCell>
                        <TableCell className="text-xs text-gray-600">
                          {device.serialNumber}
                        </TableCell>
                        <TableCell>
                          {device.facility?.name || "—"}
                        </TableCell>
                        <TableCell>{lastReading}</TableCell>
                        <TableCell>{device._count.readings}</TableCell>
                        <TableCell>
                          <Badge variant={device.isActive ? "default" : "secondary"}>
                            {device.isActive ? "Active" : "Inactive"}
                          </Badge>
                        </TableCell>
                        <TableCell className="text-right">
                          <DropdownMenu>
                            <DropdownMenuTrigger asChild>
                              <Button variant="ghost" size="sm">
                                <MoreVertical className="h-4 w-4" />
                              </Button>
                            </DropdownMenuTrigger>
                            <DropdownMenuContent align="end">
                              <DropdownMenuItem disabled>
                                View Details
                              </DropdownMenuItem>
                              <DropdownMenuItem disabled>
                                Manage Credentials
                              </DropdownMenuItem>
                              <DropdownMenuItem
                                onClick={() => handleDeleteDevice(device.id)}
                                className="text-red-600"
                              >
                                Deactivate
                              </DropdownMenuItem>
                            </DropdownMenuContent>
                          </DropdownMenu>
                        </TableCell>
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
          )}
        </CardContent>
      </Card>

      <DeviceRegisterDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        orgId={orgId}
        facilities={facilities}
        onSuccess={loadDevices}
      />
    </div>
  );
}

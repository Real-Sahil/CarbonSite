export { Scope1CombustionCalculator, type Scope1FuelType } from "./greencalculus-scope1";
export { Scope2ElectricityCalculator, type Scope2Jurisdiction } from "./greencalculus-scope2";

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { Scope1CombustionCalculator } from "./greencalculus-scope1";
import { Scope2ElectricityCalculator } from "./greencalculus-scope2";

export function GreenCalculusCalculators() {
  return (
    <Card className="w-full">
      <CardHeader>
        <CardTitle>Quick Calculators</CardTitle>
        <CardDescription>Fast estimation tools for common emissions sources</CardDescription>
      </CardHeader>
      <CardContent>
        <Tabs defaultValue="scope1" className="w-full">
          <TabsList className="grid w-full grid-cols-2">
            <TabsTrigger value="scope1">Scope 1 (Fuel)</TabsTrigger>
            <TabsTrigger value="scope2">Scope 2 (Electricity)</TabsTrigger>
          </TabsList>

          <TabsContent value="scope1" className="mt-4">
            <Scope1CombustionCalculator />
          </TabsContent>

          <TabsContent value="scope2" className="mt-4">
            <Scope2ElectricityCalculator />
          </TabsContent>
        </Tabs>
      </CardContent>
    </Card>
  );
}

import { zodResolver } from "@hookform/resolvers/zod";
import { useForm } from "react-hook-form";
import { z } from "zod";
import { insertTunnelSchema, regions, serviceProviders } from "@shared/schema";
import { Button } from "@/components/ui/button";
import {
  Form,
  FormControl,
  FormDescription,
  FormField,
  FormItem,
  FormLabel,
  FormMessage,
} from "@/components/ui/form";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from "@/components/ui/select";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { apiRequest } from "@/lib/queryClient";
import { useToast } from "@/hooks/use-toast";

// Create a schema for tunnel creation form
const formSchema = insertTunnelSchema.extend({
  targetApi: z.string().url({ message: "Please enter a valid URL" }),
  connectionTimeout: z.coerce.number().min(1).max(300),
  maxConnections: z.coerce.number().min(1).max(100),
});

interface NewTunnelFormProps {
  onSuccess?: () => void;
}

export function NewTunnelForm({ onSuccess }: NewTunnelFormProps) {
  const { toast } = useToast();
  const queryClient = useQueryClient();
  
  // Initialize form with default values
  const form = useForm<z.infer<typeof formSchema>>({
    resolver: zodResolver(formSchema),
    defaultValues: {
      name: "",
      status: "inactive",
      serviceProvider: "",
      targetApi: "",
      region: "",
      connectionTimeout: 30,
      maxConnections: 10,
      autoRestart: true,
      enableLogging: false,
      enableMonitoring: true,
    },
  });
  
  // Mutation for creating a new tunnel
  const createTunnelMutation = useMutation({
    mutationFn: async (data: z.infer<typeof formSchema>) => {
      const res = await apiRequest("POST", "/api/tunnels", data);
      return res.json();
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ['/api/tunnels'] });
      queryClient.invalidateQueries({ queryKey: ['/api/stats'] });
      
      toast({
        title: "Tunnel created",
        description: "Your new tunnel has been created successfully",
      });
      
      // Reset form
      form.reset();
      
      // Call onSuccess callback if provided
      if (onSuccess) {
        onSuccess();
      }
    },
    onError: (error) => {
      toast({
        title: "Error creating tunnel",
        description: error.message,
        variant: "destructive",
      });
    }
  });
  
  // Submit handler
  function onSubmit(values: z.infer<typeof formSchema>) {
    createTunnelMutation.mutate(values);
  }
  
  return (
    <div className="max-w-6xl mx-auto">
      <div className="bg-white dark:bg-slate-800 rounded-xl shadow-md p-6">
        <h2 className="text-2xl font-bold mb-1">Connect to Your API</h2>
        <p className="text-slate-600 dark:text-slate-400 mb-6">Set up a secure connection with a static IP in seconds</p>
        
        <Form {...form}>
          <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6">
            <div className="grid md:grid-cols-2 gap-6">
              <FormField
                control={form.control}
                name="name"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>What's this connection for?</FormLabel>
                    <FormControl>
                      <Input placeholder="e.g. Mercury Bank API" {...field} />
                    </FormControl>
                    <FormMessage />
                  </FormItem>
                )}
              />
              
              <FormField
                control={form.control}
                name="serviceProvider"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel>Choose your provider</FormLabel>
                    <Select onValueChange={field.onChange} defaultValue={field.value}>
                      <FormControl>
                        <SelectTrigger>
                          <SelectValue placeholder="Select a provider" />
                        </SelectTrigger>
                      </FormControl>
                      <SelectContent>
                        {serviceProviders.map((provider) => (
                          <SelectItem key={provider.id} value={provider.id}>
                            {provider.name}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    <FormMessage />
                  </FormItem>
                )}
              />
            </div>
            
            <FormField
              control={form.control}
              name="targetApi"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Where do you want to connect?</FormLabel>
                  <FormControl>
                    <Input placeholder="https://api.mercury.com/v1/" {...field} />
                  </FormControl>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <FormField
              control={form.control}
              name="region"
              render={({ field }) => (
                <FormItem>
                  <FormLabel>Pick a location</FormLabel>
                  <Select onValueChange={field.onChange} defaultValue={field.value}>
                    <FormControl>
                      <SelectTrigger>
                        <SelectValue placeholder="Select a region" />
                      </SelectTrigger>
                    </FormControl>
                    <SelectContent>
                      {regions.map((region) => (
                        <SelectItem key={region.id} value={region.id}>
                          {region.name}
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                  <FormMessage />
                </FormItem>
              )}
            />
            
            <div className="pt-4 flex justify-end space-x-4">
              <Button 
                type="button" 
                variant="outline"
                onClick={() => form.reset()}
              >
                Cancel
              </Button>
              <Button 
                type="submit"
                className="bg-primary text-white font-semibold hover:bg-primary/80 transition-colors"
                disabled={createTunnelMutation.isPending}
              >
                {createTunnelMutation.isPending ? "Creating..." : "Create Tunnel"}
              </Button>
            </div>
          </form>
        </Form>
      </div>
    </div>
  );
}

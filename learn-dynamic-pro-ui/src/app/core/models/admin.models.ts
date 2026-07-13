export interface AdminModuleDto {
  id: string;
  name: string;
  description: string;
  isPublished: boolean;
  totalUnits: number;
  assignedDepartments?: string[];
}

export interface LookupDto {
  id: string;
  label: string;
}

export interface CompanyDto {
  id: string;
  name: string;
  industry: string;
}

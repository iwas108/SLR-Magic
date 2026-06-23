export interface Paper {
  Paper_ID: string;
  Import_Date: string;
  Import_Source: string;
  Source: string;
  DOI: string;
  Title: string;
  Abstract: string;
  Authors: string;
  Year: number | null;
  PDF_Link: string;
  Status: string;
  Local_PDF_Status: string;
  Local_PDF_Path: string | null;
  calibration_pool?: string | null;
  calibration_tag?: string | null;
  Human_Decision?: string | null;
  Human_EC_Trigger?: string | null;
  Human_Rationale?: string | null;
  Parent_Paper_ID?: string | null;
  Parent_Paper_Title?: string | null;
}

export interface Project {
  id: string;
  name: string;
  manifesto?: string;
  objective?: string;
  questions?: string;
  qa_definition?: string;
  exclusion_criteria?: string;
  pool_a_size?: number;
  pool_b_size?: number;
  pool_c_size?: number;
  gdrive_dest_path?: string;
  cloud_provider?: 'gdrive' | 'onedrive';
  rclone_remote_name?: string;
  pool_tags?: string | {
    pool_a: { code: string; label: string }[];
    pool_b: { code: string; label: string }[];
    pool_c: { code: string; label: string }[];
  };
  ec_rules?: string | { code: string; description: string }[];
  reasoning_template?: string | string[];
  stats?: any;
  Pool_A_Tags?: any;
  Pool_B_Tags?: any;
  Pool_C_Tags?: any;
}

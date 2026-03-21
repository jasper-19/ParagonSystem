export interface Program {
  id: string;
  name: string;
}

export interface College {
  id: string;
  name: string;
  programs: Program[];
}

export class EnvVarInputDto {
  key: string;
  value: string;
}

export class UpdateEnvVarsDto {
  vars: EnvVarInputDto[];
}

export class EnvVarResponseDto {
  key: string;
  value: string; // always '***'
}

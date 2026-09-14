/// Creates a small application namespace for IRIS Ops Lens.
Class IRISOps.Installer
{

XData Setup
{
<Manifest>
  <Default Name="Namespace" Value="IRISOPS" />
  <Default Name="Database" Value="irisops" />
  <Namespace Name="${Namespace}" Code="${Namespace}" Data="${Namespace}" Create="yes" Ensemble="no">
    <Configuration>
      <Database Name="${Namespace}" Dir="${mgrdir}${Database}/data" Create="yes" Resource="%DB_${Namespace}" />
    </Configuration>
  </Namespace>
</Manifest>
}

ClassMethod Setup(ByRef pVars, pLogLevel As %Integer = 3, pInstaller As %Installer.Installer, pLogger As %Installer.AbstractLogger) As %Status [ CodeMode = objectgenerator, Internal ]
{
  Quit ##class(%Installer.Manifest).%Generate(%compiledclass, %code, "Setup")
}

}

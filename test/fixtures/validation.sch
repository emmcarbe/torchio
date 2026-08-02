<schema xmlns="http://purl.oclc.org/dsdl/schematron" queryBinding="xslt">
  <ns prefix="tei" uri="http://www.tei-c.org/ns/1.0"/>
  <pattern id="title">
    <rule context="tei:p">
      <assert test="string-length(normalize-space(.)) &gt; 0">paragraph must not be empty</assert>
    </rule>
  </pattern>
</schema>

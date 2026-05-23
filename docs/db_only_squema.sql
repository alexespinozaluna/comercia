--
-- PostgreSQL database dump
--

-- Dumped from database version 15.8
-- Dumped by pg_dump version 16.4

-- Started on 2026-05-05 16:00:47

SET statement_timeout = 0;
SET lock_timeout = 0;
SET idle_in_transaction_session_timeout = 0;
SET client_encoding = 'UTF8';
SET standard_conforming_strings = on;
SELECT pg_catalog.set_config('search_path', '', false);
SET check_function_bodies = false;
SET xmloption = content;
SET client_min_messages = warning;
SET row_security = off;

--
-- TOC entry 43 (class 2615 OID 2200)
-- Name: public; Type: SCHEMA; Schema: -; Owner: -
--

CREATE SCHEMA public;


--
-- TOC entry 3953 (class 0 OID 0)
-- Dependencies: 43
-- Name: SCHEMA public; Type: COMMENT; Schema: -; Owner: -
--

COMMENT ON SCHEMA public IS 'standard public schema';


--
-- TOC entry 415 (class 1255 OID 76662)
-- Name: actualizar_direccion_entrega(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.actualizar_direccion_entrega() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN
  -- Obtener la dirección actual del cliente
  SELECT "Direccion"
  INTO NEW."DireccionEntrega"
  FROM "ClienteDireccion"
  WHERE id = NEW."IdClienteDireccion";

  RETURN NEW;
END;
$$;


--
-- TOC entry 539 (class 1255 OID 17543)
-- Name: actualizar_saldo_total_abono(integer); Type: PROCEDURE; Schema: public; Owner: -
--

CREATE PROCEDURE public.actualizar_saldo_total_abono(IN p_id_documento integer)
    LANGUAGE plpgsql
    AS $$
BEGIN
    -- ✅ Si el ID del documento no es válido, salir sin hacer nada
    IF p_id_documento IS NULL OR p_id_documento <= 0 THEN
        RETURN;
    END IF;

    -- ✅ Actualizar TotalAbono y Saldo en la tabla Documento
    UPDATE "Documento"
    SET 
        "TotalAbono" = (SELECT COALESCE(SUM("MontoAbono"), 0) 
                        FROM "DocumentoItem" 
                        WHERE "IdDocumentoRef" = p_id_documento),
        "Saldo" = "Total" - (SELECT COALESCE(SUM("MontoAbono"), 0) 
                            FROM "DocumentoItem" 
                            WHERE "IdDocumentoRef" = p_id_documento)
    WHERE "id" = p_id_documento;
END;
$$;


--
-- TOC entry 516 (class 1255 OID 17544)
-- Name: centertext(text, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.centertext(text_to_center text, width integer) RETURNS text
    LANGUAGE plpgsql
    AS $$
DECLARE
    padding INT;
BEGIN
    IF length(text_to_center) >= width THEN
        RETURN text_to_center;
    END IF;

    padding := (width - length(text_to_center)) / 2;
    RETURN repeat(' ', padding) || text_to_center;
END;
$$;


--
-- TOC entry 540 (class 1255 OID 17545)
-- Name: fn_actualizar_saldo_total_abono(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_actualizar_saldo_total_abono() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
DECLARE
    pMontoAbono NUMERIC := 0; -- Variable para almacenar el total de abonos
    pIdDocumentoRef INT; -- Variable para el ID del documento referenciado
BEGIN
    -- ✅ Determinar el ID del documento referenciado según la operación
     pIdDocumentoRef := COALESCE(NEW."IdDocumentoRef", OLD."IdDocumentoRef", 0);

    -- ✅ Evitar ejecución si IdDocumentoRef es nulo o menor o igual a 0
    IF COALESCE(pIdDocumentoRef, 0) <= 0 THEN
        RETURN NULL; -- Sale sin hacer nada si no es válido
    END IF;

    -- ✅ Obtener el total de abonos antes de actualizar la tabla
    SELECT COALESCE(SUM("MontoAbono"), 0)
    INTO pMontoAbono
    FROM "DocumentoItem"
    WHERE "IdDocumentoRef" = pIdDocumentoRef;

    -- ✅ Actualizar el documento con el total de abonos calculado
    UPDATE "Documento"
    SET 
        "TotalAbono" = pMontoAbono,
        "Saldo" = "Total" - pMontoAbono
    WHERE "id" = pIdDocumentoRef;

    RETURN NULL; -- Se devuelve NULL en triggers AFTER, ya que no modificamos la fila en sí
END;
$$;


--
-- TOC entry 514 (class 1255 OID 379097)
-- Name: fn_audit_documento(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_audit_documento() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        INSERT INTO "DocumentoAudit"
        (
            "IdDocumento",
            "Operacion",
            "UsuarioAudit",
            "DataNew"
        )
        VALUES
        (
            NEW.id,
            'INSERT',
            current_user,
            to_jsonb(NEW)
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        INSERT INTO "DocumentoAudit"
        (
            "IdDocumento",
            "Operacion",
            "UsuarioAudit",
            "DataOld",
            "DataNew"
        )
        VALUES
        (
            NEW.id,
            'UPDATE',
            current_user,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        INSERT INTO "DocumentoAudit"
        (
            "IdDocumento",
            "Operacion",
            "UsuarioAudit",
            "DataOld"
        )
        VALUES
        (
            OLD.id,
            'DELETE',
            current_user,
            to_jsonb(OLD)
        );

        RETURN OLD;

    END IF;

    RETURN NULL;
END;
$$;


--
-- TOC entry 520 (class 1255 OID 379109)
-- Name: fn_audit_documento_item(); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.fn_audit_documento_item() RETURNS trigger
    LANGUAGE plpgsql
    AS $$
BEGIN

    IF TG_OP = 'INSERT' THEN

        INSERT INTO "DocumentoItemAudit"
        (
            "IdDocumentoItem",
            "Operacion",
            "UsuarioAudit",
            "DataNew"
        )
        VALUES
        (
            NEW.id,
            'INSERT',
            current_user,
            to_jsonb(NEW)
        );

        RETURN NEW;

    ELSIF TG_OP = 'UPDATE' THEN

        INSERT INTO "DocumentoItemAudit"
        (
            "IdDocumentoItem",
            "Operacion",
            "UsuarioAudit",
            "DataOld",
            "DataNew"
        )
        VALUES
        (
            NEW.id,
            'UPDATE',
            current_user,
            to_jsonb(OLD),
            to_jsonb(NEW)
        );

        RETURN NEW;

    ELSIF TG_OP = 'DELETE' THEN

        INSERT INTO "DocumentoItemAudit"
        (
            "IdDocumentoItem",
            "Operacion",
            "UsuarioAudit",
            "DataOld"
        )
        VALUES
        (
            OLD.id,
            'DELETE',
            current_user,
            to_jsonb(OLD)
        );

        RETURN OLD;

    END IF;

    RETURN NULL;
END;
$$;


--
-- TOC entry 541 (class 1255 OID 17546)
-- Name: generate_ticket_text(integer, integer); Type: FUNCTION; Schema: public; Owner: -
--

CREATE FUNCTION public.generate_ticket_text(venta_id integer, width integer) RETURNS text
    LANGUAGE plpgsql
    AS $$DECLARE
    venta RECORD;
    venta_item RECORD;
    negocio RECORD;
    output TEXT := '';
    line_separator TEXT;
BEGIN
    -- Definir el separador de líneas basado en el ancho
    line_separator := repeat('-', width);

    -- Obtener la información de la venta
  SELECT  to_char(a."FechaEmision", 'DD/MM/YYYY')  AS "FechaEmision", 
           COALESCE(b."Nombre", '') AS "Cliente",
           CASE WHEN a."bCredito" = true THEN 'CREDITO' ELSE 'CONTADO' END AS "Pago",
           
            to_char(a."Total" / 1000.0, 'FM999G999D000') AS "Total",
            "DireccionEntrega"

    INTO venta
    FROM "Documento" a
    LEFT JOIN "Cliente" b ON a."IdCliente" = b.id
    WHERE a.id = venta_id;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Venta ID % no encontrada', venta_id;
    END IF;

    -- Obtener la información del negocio
    SELECT "Nombre", "Direccion", "Telefono"
    INTO negocio
    FROM "Negocio"
    LIMIT 1;

    IF NOT FOUND THEN
        RAISE EXCEPTION 'Información del negocio no encontrada';
    END IF;

    -- Agregar encabezado del negocio
    output := output || CenterText(negocio."Nombre", width) || E'\n';
    output := output || CenterText(negocio."Direccion", width) || E'\n';
    output := output || CenterText('Tel: ' || negocio."Telefono", width) || E'\n';
    output := output || line_separator || E'\n';

    -- Agregar detalles del ticket
    output := output || 'F. Emision: ' || venta."FechaEmision" || E'\n';
    output := output || 'Pago: ' || venta."Pago" || E'\n';
    output := output || 'Cliente: ' || venta."Cliente" || E'\n';
    output := output || 'Direccion: ' || venta."DireccionEntrega" || E'\n';
    output := output || line_separator || E'\n';

    -- Agregar tabla de productos
    output := output || format('%-5s %-18s %7s', 'Cant.', 'Descripcion', 'Total') || E'\n';
    
    FOR venta_item IN
        SELECT "Cantidad", CONCAT("Descripcion",' ', "PrecioVenta") AS "Descripcion", 
        to_char("Total" / 1000.0, 'FM999G999D000') AS "Total"
        FROM "DocumentoItem"
        WHERE "IdDocumento" = venta_id
    LOOP
        output := output || format('%-5s %-18s %7s',
                                   venta_item."Cantidad",
                                   venta_item."Descripcion",
                                   venta_item."Total") || E'\n';
    END LOOP;
    
    output := output || line_separator || E'\n';

    -- Agregar total
    output := output || lpad('TOTAL:', width - 10, ' ') || lpad(venta."Total" || ' ', 10) || E'\n';
    output := output || E'\n';
    output := output || CenterText('Gracias por su compra', width) || E'\n';

    RETURN output;
END;$$;


SET default_tablespace = '';

SET default_table_access_method = heap;

--
-- TOC entry 289 (class 1259 OID 17672)
-- Name: Cliente; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Cliente" (
    id bigint NOT NULL,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "Nombre" character varying,
    "NroTelefono" character varying,
    "TipoDocumento" character varying,
    "NroDocumento" character varying,
    "Comentario" character varying
);


--
-- TOC entry 290 (class 1259 OID 17678)
-- Name: ClienteDireccion; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."ClienteDireccion" (
    id bigint NOT NULL,
    "Direccion" character varying,
    "Telefono" character varying,
    "Contacto" character varying,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "IdCliente" bigint,
    "bPrincipal" boolean DEFAULT false
);


--
-- TOC entry 291 (class 1259 OID 17685)
-- Name: ClienteDireccion_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."ClienteDireccion" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."ClienteDireccion_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 292 (class 1259 OID 17686)
-- Name: Cliente_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Cliente" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Cliente_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 293 (class 1259 OID 17687)
-- Name: Documento; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Documento" (
    id bigint NOT NULL,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "Descripcion" character varying,
    "Total" numeric DEFAULT '0'::numeric,
    "Concepto" character varying,
    "bCredito" boolean,
    "IdCliente" bigint,
    "FechaEmision" date,
    "IdClienteDireccion" bigint,
    "DireccionEntrega" character varying,
    "TotalAbono" numeric DEFAULT '0'::numeric,
    "IdTipoDocumento" bigint,
    "Saldo" numeric DEFAULT '0'::numeric,
    "IdMetodoPago" bigint
);


--
-- TOC entry 323 (class 1259 OID 379084)
-- Name: DocumentoAudit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentoAudit" (
    id bigint NOT NULL,
    "IdDocumento" bigint NOT NULL,
    "Operacion" character varying(10) NOT NULL,
    "FechaAudit" timestamp with time zone DEFAULT now() NOT NULL,
    "UsuarioAudit" text,
    "DataOld" jsonb,
    "DataNew" jsonb
);


--
-- TOC entry 322 (class 1259 OID 379083)
-- Name: DocumentoAudit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DocumentoAudit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3954 (class 0 OID 0)
-- Dependencies: 322
-- Name: DocumentoAudit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DocumentoAudit_id_seq" OWNED BY public."DocumentoAudit".id;


--
-- TOC entry 294 (class 1259 OID 17696)
-- Name: DocumentoItem; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentoItem" (
    id bigint NOT NULL,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "IdProducto" bigint,
    "Descripcion" character varying,
    "Cantidad" numeric,
    "PrecioVenta" numeric,
    "Total" numeric,
    "IdDocumento" bigint,
    "IdDocumentoRef" bigint,
    "MontoAbono" numeric
);


--
-- TOC entry 325 (class 1259 OID 379100)
-- Name: DocumentoItemAudit; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."DocumentoItemAudit" (
    id bigint NOT NULL,
    "IdDocumentoItem" bigint NOT NULL,
    "Operacion" character varying(10) NOT NULL,
    "FechaAudit" timestamp with time zone DEFAULT now() NOT NULL,
    "UsuarioAudit" text,
    "DataOld" jsonb,
    "DataNew" jsonb
);


--
-- TOC entry 324 (class 1259 OID 379099)
-- Name: DocumentoItemAudit_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

CREATE SEQUENCE public."DocumentoItemAudit_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1;


--
-- TOC entry 3955 (class 0 OID 0)
-- Dependencies: 324
-- Name: DocumentoItemAudit_id_seq; Type: SEQUENCE OWNED BY; Schema: public; Owner: -
--

ALTER SEQUENCE public."DocumentoItemAudit_id_seq" OWNED BY public."DocumentoItemAudit".id;


--
-- TOC entry 295 (class 1259 OID 17702)
-- Name: Negocio; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Negocio" (
    id bigint NOT NULL,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "Nombre" character varying,
    "Telefono" character varying,
    "Direccion" character varying,
    "Logo" character varying
);


--
-- TOC entry 296 (class 1259 OID 17708)
-- Name: Empresa_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Negocio" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Empresa_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 297 (class 1259 OID 17709)
-- Name: MetodoPago; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."MetodoPago" (
    id bigint NOT NULL,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "Nombre" character varying,
    "Simbolo" character varying
);


--
-- TOC entry 298 (class 1259 OID 17715)
-- Name: MetodoPago_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."MetodoPago" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."MetodoPago_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 299 (class 1259 OID 17716)
-- Name: Producto; Type: TABLE; Schema: public; Owner: -
--

CREATE TABLE public."Producto" (
    id bigint NOT NULL,
    "FechaCreacion" timestamp with time zone DEFAULT now() NOT NULL,
    "Nombre" character varying,
    "PrecioCosto" numeric,
    "PrecioVenta" numeric,
    "Cantidad" bigint
);


--
-- TOC entry 300 (class 1259 OID 17722)
-- Name: Producto_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Producto" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Producto_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 301 (class 1259 OID 17723)
-- Name: VentaItem_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."DocumentoItem" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."VentaItem_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 302 (class 1259 OID 17724)
-- Name: Venta_id_seq; Type: SEQUENCE; Schema: public; Owner: -
--

ALTER TABLE public."Documento" ALTER COLUMN id ADD GENERATED BY DEFAULT AS IDENTITY (
    SEQUENCE NAME public."Venta_id_seq"
    START WITH 1
    INCREMENT BY 1
    NO MINVALUE
    NO MAXVALUE
    CACHE 1
);


--
-- TOC entry 3764 (class 2604 OID 379087)
-- Name: DocumentoAudit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoAudit" ALTER COLUMN id SET DEFAULT nextval('public."DocumentoAudit_id_seq"'::regclass);


--
-- TOC entry 3766 (class 2604 OID 379103)
-- Name: DocumentoItemAudit id; Type: DEFAULT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoItemAudit" ALTER COLUMN id SET DEFAULT nextval('public."DocumentoItemAudit_id_seq"'::regclass);


--
-- TOC entry 3771 (class 2606 OID 17828)
-- Name: ClienteDireccion ClienteDireccion_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClienteDireccion"
    ADD CONSTRAINT "ClienteDireccion_pkey" PRIMARY KEY (id);


--
-- TOC entry 3769 (class 2606 OID 17830)
-- Name: Cliente Cliente_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Cliente"
    ADD CONSTRAINT "Cliente_pkey" PRIMARY KEY (id);


--
-- TOC entry 3785 (class 2606 OID 379092)
-- Name: DocumentoAudit DocumentoAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoAudit"
    ADD CONSTRAINT "DocumentoAudit_pkey" PRIMARY KEY (id);


--
-- TOC entry 3787 (class 2606 OID 379108)
-- Name: DocumentoItemAudit DocumentoItemAudit_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoItemAudit"
    ADD CONSTRAINT "DocumentoItemAudit_pkey" PRIMARY KEY (id);


--
-- TOC entry 3779 (class 2606 OID 17832)
-- Name: Negocio Empresa_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Negocio"
    ADD CONSTRAINT "Empresa_pkey" PRIMARY KEY (id);


--
-- TOC entry 3781 (class 2606 OID 17834)
-- Name: MetodoPago MetodoPago_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."MetodoPago"
    ADD CONSTRAINT "MetodoPago_pkey" PRIMARY KEY (id);


--
-- TOC entry 3783 (class 2606 OID 17836)
-- Name: Producto Producto_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Producto"
    ADD CONSTRAINT "Producto_pkey" PRIMARY KEY (id);


--
-- TOC entry 3777 (class 2606 OID 17838)
-- Name: DocumentoItem VentaItem_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoItem"
    ADD CONSTRAINT "VentaItem_pkey" PRIMARY KEY (id);


--
-- TOC entry 3773 (class 2606 OID 17840)
-- Name: Documento Venta_id_key; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Documento"
    ADD CONSTRAINT "Venta_id_key" UNIQUE (id);


--
-- TOC entry 3775 (class 2606 OID 17842)
-- Name: Documento Venta_pkey; Type: CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Documento"
    ADD CONSTRAINT "Venta_pkey" PRIMARY KEY (id);


--
-- TOC entry 3794 (class 2620 OID 76724)
-- Name: Documento trg_actualizar_direccion_entrega; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_actualizar_direccion_entrega BEFORE INSERT OR UPDATE OF "IdClienteDireccion" ON public."Documento" FOR EACH ROW EXECUTE FUNCTION public.actualizar_direccion_entrega();


--
-- TOC entry 3796 (class 2620 OID 17906)
-- Name: DocumentoItem trg_actualizar_saldo_total_abono; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_actualizar_saldo_total_abono AFTER INSERT OR DELETE OR UPDATE ON public."DocumentoItem" FOR EACH ROW EXECUTE FUNCTION public.fn_actualizar_saldo_total_abono();


--
-- TOC entry 3795 (class 2620 OID 379098)
-- Name: Documento trg_audit_documento; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_documento AFTER INSERT OR DELETE OR UPDATE ON public."Documento" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_documento();


--
-- TOC entry 3797 (class 2620 OID 379110)
-- Name: DocumentoItem trg_audit_documento_item; Type: TRIGGER; Schema: public; Owner: -
--

CREATE TRIGGER trg_audit_documento_item AFTER INSERT OR DELETE OR UPDATE ON public."DocumentoItem" FOR EACH ROW EXECUTE FUNCTION public.fn_audit_documento_item();


--
-- TOC entry 3788 (class 2606 OID 17964)
-- Name: ClienteDireccion ClienteDireccion_IdCliente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."ClienteDireccion"
    ADD CONSTRAINT "ClienteDireccion_IdCliente_fkey" FOREIGN KEY ("IdCliente") REFERENCES public."Cliente"(id) ON DELETE CASCADE;


--
-- TOC entry 3789 (class 2606 OID 17969)
-- Name: Documento Documento_IdMetodoPago_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Documento"
    ADD CONSTRAINT "Documento_IdMetodoPago_fkey" FOREIGN KEY ("IdMetodoPago") REFERENCES public."MetodoPago"(id);


--
-- TOC entry 3792 (class 2606 OID 17974)
-- Name: DocumentoItem VentaItem_IdProducto_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoItem"
    ADD CONSTRAINT "VentaItem_IdProducto_fkey" FOREIGN KEY ("IdProducto") REFERENCES public."Producto"(id);


--
-- TOC entry 3793 (class 2606 OID 17979)
-- Name: DocumentoItem VentaItem_IdVenta_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."DocumentoItem"
    ADD CONSTRAINT "VentaItem_IdVenta_fkey" FOREIGN KEY ("IdDocumento") REFERENCES public."Documento"(id) ON DELETE CASCADE;


--
-- TOC entry 3790 (class 2606 OID 17984)
-- Name: Documento Venta_IdClente_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Documento"
    ADD CONSTRAINT "Venta_IdClente_fkey" FOREIGN KEY ("IdCliente") REFERENCES public."Cliente"(id);


--
-- TOC entry 3791 (class 2606 OID 17989)
-- Name: Documento Venta_IdClienteDireccion_fkey; Type: FK CONSTRAINT; Schema: public; Owner: -
--

ALTER TABLE ONLY public."Documento"
    ADD CONSTRAINT "Venta_IdClienteDireccion_fkey" FOREIGN KEY ("IdClienteDireccion") REFERENCES public."ClienteDireccion"(id);


-- Completed on 2026-05-05 16:01:04

--
-- PostgreSQL database dump complete
--


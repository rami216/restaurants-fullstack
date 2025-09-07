// src/components/builder/FormRenderer.tsx

import React, { useState, useLayoutEffect, useRef } from "react";
import { motion } from "framer-motion";
import api from "@/lib/axios";
import { Element as ElementType, FormField, WebsiteData } from "./Properties";
import { getMotionConfig } from "./animate";
import type { Element as BuilderElement } from "./Properties";
import Mustache from "mustache";
import saasApi from "@/lib/saasApi";
interface AiElementRunnerProps {
  element: BuilderElement;
}
const AiElementRunner: React.FC<AiElementRunnerProps> = ({ element }) => {
  const { aiPayload } = element;
  const containerRef = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (!aiPayload || !containerRef.current) return;

    // --- THIS IS THE FIX ---
    // Get the backend URL and create a safe copy of the properties
    const BACKEND_URL = api.defaults.baseURL || "";
    const processedProps = { ...aiPayload.properties };

    // Define common keys that might contain image URLs
    const imageUrlKeys = ["src", "image_url", "backgroundImage"];

    // Loop through the properties and fix any relative image paths
    for (const key in processedProps) {
      if (imageUrlKeys.includes(key)) {
        const value = processedProps[key];
        if (typeof value === "string" && value.startsWith("/")) {
          processedProps[key] = `${BACKEND_URL}${value}`;
        }
      }
    }
    // --- END OF FIX ---

    // 1) Strip out any <script>…</script> from the HTML/CSS
    let htmlOnly = aiPayload.aiTemplate.replace(
      /<script[\s\S]*?<\/script>/g,
      ""
    );

    // 2) (Your Handlebars conversion logic is good, keep it)
    const loopMatches = [...htmlOnly.matchAll(/{{#each\s+([\w$]+)}}/g)];
    loopMatches.forEach(([fullMatch, arrKey]) => {
      htmlOnly = htmlOnly.replace(fullMatch, `{{#${arrKey}}}`);
      htmlOnly = htmlOnly.replace(/{{\/each}}/, `{{/${arrKey}}}`);
    });
    htmlOnly = htmlOnly.replace(/{{\s*this\s*}}/g, "{{.}}");

    // 3) Render the template with the PROCESSED properties
    let rendered: string;
    try {
      rendered = Mustache.render(htmlOnly, processedProps); // Use the fixed props
    } catch (mErr) {
      console.error("Mustache.render failed, falling back to raw HTML:", mErr);
      rendered = htmlOnly;
    }
    containerRef.current.innerHTML = rendered;

    // 4) Execute JS if provided
    if (aiPayload.script) {
      const jsBody = aiPayload.script
        .replace(/^\s*<script[^>]*>/, "")
        .replace(/<\/script>\s*$/, "");
      try {
        const fn = new Function("container", jsBody);
        fn(containerRef.current);
      } catch (jsErr) {
        console.error("Error running AI script:", jsErr);
      }
    }
  }, [
    aiPayload?.aiTemplate,
    aiPayload?.script,
    JSON.stringify(aiPayload?.properties),
  ]);

  return <div ref={containerRef} />;
};
interface FormRendererProps {
  element: ElementType;
  websiteData: WebsiteData | null;
}

export const FormRenderer: React.FC<FormRendererProps> = ({
  element,
  websiteData,
}) => {
  const [submissionStatus, setSubmissionStatus] = useState<
    "idle" | "submitting" | "success" | "error"
  >("idle");

  const handleFormSubmit = async (e: React.FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!websiteData) return;

    const formData = new FormData(e.currentTarget);
    const submissionData: Record<string, any> = {};
    formData.forEach((value, key) => {
      submissionData[key] = value;
    });

    setSubmissionStatus("submitting");
    try {
      await saasApi.post("/builder/form-submissions", {
        website_id: websiteData.website_id,
        form_element_id: element.element_id,
        submission_data: submissionData,
      });
      setSubmissionStatus("success");
    } catch (error) {
      console.error("Form submission failed:", error);
      setSubmissionStatus("error");
    }
  };

  const { aiPayload } = element;
  // --- FIX #1: Get props from either aiPayload OR the top-level element properties ---
  const props = aiPayload?.properties || element.properties || {};
  const style = props.style || {};
  const { initial, animate, transition } = getMotionConfig(props.animation);

  const buttonStyle = {
    backgroundColor: props.buttonColor || "black",
    color: props.buttonTextColor || "white",
    borderRadius: props.borderRadius || "8px",
  };

  if (submissionStatus === "success") {
    return (
      <div className="p-4 text-center bg-green-100 text-green-800 rounded-lg">
        <h4 className="font-bold">{props.successTitle || "Thank You!"}</h4>
        <p>{props.successMessage || "Your message has been received."}</p>
      </div>
    );
  }

  return (
    <motion.div
      style={style}
      initial={initial}
      animate={animate}
      transition={transition}
    >
      <h3 className="text-2xl font-bold mb-4 text-gray-800">
        {props.title || "Form Title"}
      </h3>
      <form className="space-y-4" onSubmit={handleFormSubmit}>
        {/* --- FIX #2: Add the 'else' block to render standard forms --- */}
        {aiPayload ? (
          // If it's an AI element, render its dynamic template
          <AiElementRunner element={element} />
        ) : (
          // Otherwise, render the standard JSX for a non-refined form
          (props.fields || []).map((field: FormField) => (
            <div key={field.id}>
              <label
                className="block text-sm font-medium mb-1"
                style={props.labelStyle}
              >
                {field.label}
              </label>
              <input
                type="text"
                name={field.label} // The name attribute is critical for FormData
                placeholder={field.placeholder}
                required
                className="w-full border border-gray-300 rounded-md shadow-sm p-2"
              />
            </div>
          ))
        )}

        {/* The button is now outside the if/else, so it appears for both types */}
        <button
          type="submit"
          style={buttonStyle}
          disabled={submissionStatus === "submitting"}
          className="w-full py-2 px-4 font-semibold disabled:opacity-50"
        >
          {submissionStatus === "submitting"
            ? "Submitting..."
            : props.buttonText || "Submit"}
        </button>

        {submissionStatus === "error" && (
          <p className="text-sm text-red-600 mt-2">
            Submission failed. Please try again.
          </p>
        )}
      </form>
    </motion.div>
  );
};

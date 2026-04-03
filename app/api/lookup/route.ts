import { NextRequest, NextResponse } from "next/server";

const CLICKUP_LIST_ID = "901521864851";

// Custom field IDs from the Client Database list
const FIELD_IDS = {
  businessName: "04e8a8ed-fdc4-460e-8cd3-a7a6dfa18442",
  clientName: "c6bfbe39-3d78-4c02-8f4a-aee90b8af791",
  brandTone: "4a45b73a-9132-40af-842c-f85656c0b32c",
  services: "3ef4a288-1302-4ef8-8d32-c73d60c91bee",
  website: "d6c24d5a-9f05-4e13-a8da-3b90b50d0e55",
  brandAssets: "82076296-fc1e-4ffc-8dbe-f4f2449b656f",
  onboardingDoc: "b2ced681-d172-494b-b293-1ad3493456d7",
  targetAudience: "aeb6215b-a881-48cc-b10a-8fa1a353c5c0",
  objections: "c3362a2e-5b7c-4c14-844d-c0aee3461b8f",
  wordsToAvoid: "13a379f4-7eae-4932-921f-4983b04298c4",
  ideasToAvoid: "29f75a44-9901-47bf-9fa0-3d5465c47a7e",
};

interface ClickUpTask {
  id: string;
  name: string;
  custom_fields: Array<{
    id: string;
    name: string;
    value: unknown;
  }>;
  attachments?: Array<{
    url: string;
    title: string;
  }>;
}

function getFieldValue(task: ClickUpTask, fieldId: string): string {
  const field = task.custom_fields.find((f) => f.id === fieldId);
  if (!field || !field.value) return "";

  // Handle attachment fields (returns array)
  if (Array.isArray(field.value)) {
    const firstAttachment = field.value[0];
    if (firstAttachment?.url) return firstAttachment.url;
    return "";
  }

  return String(field.value).trim();
}

export async function GET(request: NextRequest) {
  try {
    const company = request.nextUrl.searchParams.get("company");

    if (!company) {
      return NextResponse.json(
        { found: false, error: "Missing company parameter." },
        { status: 400 }
      );
    }

    const clickupKey = process.env.CLICKUP_API_KEY;
    if (!clickupKey) {
      return NextResponse.json(
        { found: false, error: "ClickUp API not configured." },
        { status: 500 }
      );
    }

    // Search ClickUp tasks in the Client Database list
    // Use the get tasks endpoint with custom field filter
    const tasksUrl = `https://api.clickup.com/api/v2/list/${CLICKUP_LIST_ID}/task?include_closed=true&subtasks=false`;

    const tasksRes = await fetch(tasksUrl, {
      headers: { Authorization: clickupKey },
    });

    if (!tasksRes.ok) {
      console.error("ClickUp API error:", tasksRes.status);
      return NextResponse.json(
        { found: false, error: "Failed to search ClickUp." },
        { status: 500 }
      );
    }

    const tasksData = await tasksRes.json();
    const tasks: ClickUpTask[] = tasksData.tasks || [];

    // Find the task where "Business Name & Industry" matches (case-insensitive)
    const companyLower = company.toLowerCase();
    const matchedTask = tasks.find((task) => {
      const bizName = getFieldValue(task, FIELD_IDS.businessName);
      return bizName.toLowerCase() === companyLower;
    });

    if (!matchedTask) {
      return NextResponse.json({ found: false, error: "Client not found." });
    }

    // Extract all relevant custom fields
    const businessName = getFieldValue(matchedTask, FIELD_IDS.businessName);
    const clientName = getFieldValue(matchedTask, FIELD_IDS.clientName);
    const brandTone = getFieldValue(matchedTask, FIELD_IDS.brandTone);
    const services = getFieldValue(matchedTask, FIELD_IDS.services);
    const website = getFieldValue(matchedTask, FIELD_IDS.website);
    const logoUrl = getFieldValue(matchedTask, FIELD_IDS.brandAssets);
    const targetAudience = getFieldValue(matchedTask, FIELD_IDS.targetAudience);
    const objections = getFieldValue(matchedTask, FIELD_IDS.objections);
    const wordsToAvoid = getFieldValue(matchedTask, FIELD_IDS.wordsToAvoid);
    const ideasToAvoid = getFieldValue(matchedTask, FIELD_IDS.ideasToAvoid);
    const onboardingDocUrl = getFieldValue(matchedTask, FIELD_IDS.onboardingDoc);

    // Fetch the Pastebin onboarding doc if URL exists
    let onboardingDoc = "";
    if (onboardingDocUrl && onboardingDocUrl.startsWith("http")) {
      try {
        const pasteRes = await fetch(onboardingDocUrl);
        if (pasteRes.ok) {
          onboardingDoc = await pasteRes.text();
        }
      } catch (e) {
        console.error("Failed to fetch Pastebin:", e);
      }
    }

    return NextResponse.json({
      found: true,
      client: {
        name: clientName,
        businessName,
        brandTone,
        services,
        website,
        logoUrl,
        targetAudience,
        objections,
        wordsToAvoid,
        ideasToAvoid,
        onboardingDoc,
      },
    });
  } catch (error) {
    console.error("Lookup error:", error);
    return NextResponse.json(
      { found: false, error: "Lookup failed." },
      { status: 500 }
    );
  }
}
